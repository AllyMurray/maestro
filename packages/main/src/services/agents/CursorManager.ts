import { spawn, ChildProcess } from 'child_process';
import type { AgentOpts, AgentType } from '@maestro/shared';
import { BaseAgentManager } from './BaseAgentManager';
import { logger } from '../logger';

const DEFAULT_WATCHDOG_TIMEOUT = 600_000; // 10 minutes

export class CursorManager extends BaseAgentManager {
  readonly type: AgentType = 'cursor';
  readonly displayName = 'Cursor';

  private _command = 'cursor-agent';
  get command(): string {
    return this._command;
  }

  private process: ChildProcess | null = null;
  private buffer = '';
  private stderrBuffer = '';
  private emittedTextThisTurn = '';
  private sawTextDeltaThisTurn = false;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimeout: number;
  private _opts: AgentOpts = {};

  constructor(watchdogTimeout = DEFAULT_WATCHDOG_TIMEOUT) {
    super();
    this.watchdogTimeout = watchdogTimeout;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(execFile);
      // Try cursor-agent first, fall back to cursor
      try {
        await exec('cursor-agent', ['--version'], { timeout: 5000 });
        this._command = 'cursor-agent';
        return true;
      } catch {
        await exec('cursor', ['agent', '--version'], { timeout: 5000 });
        this._command = 'cursor';
        return true;
      }
    } catch {
      return false;
    }
  }

  private async resolveCommand(): Promise<void> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);
    try {
      await exec('cursor-agent', ['--version'], { timeout: 5000 });
      this._command = 'cursor-agent';
    } catch {
      await exec('cursor', ['agent', '--version'], { timeout: 5000 });
      this._command = 'cursor';
    }
  }

  async start(workspacePath: string, opts: AgentOpts): Promise<void> {
    this._workspacePath = workspacePath;
    this._opts = opts;
    this.setStatus('starting');

    await this.resolveCommand();

    this.setStatus('running');
    logger.info(`Cursor started in ${workspacePath} (command: ${this._command})`);
  }

  async send(prompt: string): Promise<void> {
    if (this._status === 'stopped' || this._status === 'error') {
      throw new Error('Agent is not running');
    }

    this.setStatus('running');

    const args: string[] = [];
    if (this._command === 'cursor') {
      args.push('agent');
    }
    args.push('--print', '--output-format', 'stream-json', '--stream-partial-output', '--trust');
    if (this._opts.permissions === 'skip' || this._opts.permissions == null) {
      args.push('--force');
    }
    if (this._workspacePath) args.push('--workspace', this._workspacePath);
    if (this._sessionId) {
      args.push('--resume', this._sessionId);
    } else if (this._opts.resumeSessionId) {
      args.push('--resume', this._opts.resumeSessionId);
    }
    if (this._opts?.model) args.push('--model', this._opts.model);
    args.push(prompt); // positional, must be last

    const env: Record<string, string> = { ...(process.env as Record<string, string>) };
    if (this._opts?.apiKey) {
      env.CURSOR_API_KEY = this._opts.apiKey;
    }

    logger.info(`Spawning: ${this._command} ${args.join(' ')}`);

    this.process = spawn(this._command, args, {
      cwd: this._workspacePath!,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.buffer = '';
    this.stderrBuffer = '';
    this.emittedTextThisTurn = '';
    this.sawTextDeltaThisTurn = false;
    this.resetWatchdog();

    this.process.stdout?.on('data', (data: Buffer) => {
      this.resetWatchdog();
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.resetWatchdog();
      const text = data.toString();
      this.stderrBuffer += text;
      const trimmed = text.trim();
      if (trimmed) {
        logger.debug(`[cursor stderr] ${trimmed}`);
      }
    });

    this.process.on('close', (code, signal) => {
      this.clearWatchdog();
      if (this.buffer.trim()) {
        this.emitText(this.buffer.trim());
        this.buffer = '';
      }

      if (this._status === 'stopped') {
        this.process = null;
        return;
      }

      if (code === 0) {
        this.setStatus('waiting');
      } else {
        this.setStatus('error');
        const stderr = this.stderrBuffer.trim();
        const message = stderr
          ? stderr
          : code === null && signal
            ? `Cursor exited with signal ${signal}`
            : `Cursor exited with code ${code}`;
        this.emit('error', new Error(message));
      }
      this.process = null;
    });

    this.process.on('error', (err) => {
      this.clearWatchdog();
      this.setStatus('error');
      this.emit('error', err);
      this.process = null;
    });
  }

  private resetWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      logger.warn(`Cursor watchdog triggered after ${this.watchdogTimeout}ms of no output`);
      this.emitOutput('status', 'Still waiting for Cursor output...', {
        internal: false,
        statusKind: 'watchdog',
      });
      this.resetWatchdog();
    }, this.watchdogTimeout);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch {
        this.emitText(line);
      }
    }
  }

  private emitText(content: string): void {
    this.emitOutput('text', content);
    this.emittedTextThisTurn += content;
  }

  private isDuplicateForTurn(content: string): boolean {
    const normalizedIncoming = this.normalizeWhitespace(content);
    const normalizedPrior = this.normalizeWhitespace(this.emittedTextThisTurn);
    if (!normalizedIncoming || !normalizedPrior) return false;

    return (
      normalizedIncoming === normalizedPrior ||
      normalizedPrior.endsWith(normalizedIncoming) ||
      normalizedIncoming.endsWith(normalizedPrior)
    );
  }

  private emitTextIfNovel(content: string): void {
    if (!this.isDuplicateForTurn(content)) {
      this.emitText(content);
    }
  }

  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    switch (type) {
      case 'system': {
        const sessionId = msg.session_id as string;
        if (sessionId) {
          this._sessionId = sessionId;
          this.emit('session_id', sessionId);
        }
        break;
      }

      case 'assistant':
      case 'content_block_delta': {
        const delta = msg.delta as Record<string, unknown>;
        if (delta?.type === 'text_delta') {
          this.sawTextDeltaThisTurn = true;
          this.emitText(delta.text as string);
        }
        // Handle full message
        const content = msg.message as Record<string, unknown>;
        if (content?.content) {
          const blocks = content.content as Array<Record<string, unknown>>;
          if (Array.isArray(blocks)) {
            for (const block of blocks) {
              if (block.type === 'text') {
                if (!this.sawTextDeltaThisTurn) {
                  this.emitTextIfNovel(block.text as string);
                }
              } else if (block.type === 'tool_use') {
                this.emitOutput('tool_call', JSON.stringify(block), {
                  toolName: block.name as string,
                });
              }
            }
          }
        }
        break;
      }

      case 'result': {
        const result = msg.result as string;
        if (result) {
          this.emitTextIfNovel(result);
        }
        break;
      }

      case 'tool_call': {
        const subtype = msg.subtype as string | undefined;
        const toolCall = msg.tool_call;
        if (subtype === 'started') {
          this.emitOutput('tool_call', JSON.stringify(toolCall ?? {}), {
            toolName: 'tool_call',
          });
        } else if (subtype === 'completed') {
          this.emitOutput('tool_result', JSON.stringify(toolCall ?? {}), {
            toolName: 'tool_call',
          });
        }
        break;
      }

      case 'thinking': {
        const text = msg.text as string | undefined;
        if (text) {
          this.emitOutput('status', text, {
            internal: true,
            statusKind: 'thinking',
          });
        }
        break;
      }
    }
  }

  async stop(): Promise<void> {
    this.clearWatchdog();
    if (this.process) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
    this.setStatus('stopped');
    logger.info('Cursor stopped');
  }
}
