import { spawn, ChildProcess } from 'child_process';
import type { AgentOpts, AgentType } from '@maestro/shared';
import { BaseAgentManager } from './BaseAgentManager';
import { logger } from '../logger';

export class CodexManager extends BaseAgentManager {
  readonly type: AgentType = 'codex';
  readonly displayName = 'Codex';
  readonly command = 'codex';

  private process: ChildProcess | null = null;
  private buffer = '';
  private _opts: AgentOpts = {};

  async isAvailable(): Promise<boolean> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(execFile);
      await exec(this.command, ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async start(workspacePath: string, opts: AgentOpts): Promise<void> {
    this._workspacePath = workspacePath;
    this._opts = opts;
    this.setStatus('starting');
    this.setStatus('waiting');
    logger.info(`Codex started in ${workspacePath}`);
  }

  async send(prompt: string): Promise<void> {
    if (this._status === 'stopped' || this._status === 'error') {
      throw new Error('Agent is not running');
    }

    this.setStatus('running');

    const args: string[] = ['exec', '--json'];
    if (this._workspacePath) args.push('-C', this._workspacePath);
    if (this._opts.model) args.push('-m', this._opts.model);
    args.push(prompt); // positional, must be last

    const env: Record<string, string> = { ...(process.env as Record<string, string>) };
    if (this._opts.apiKey) {
      env.OPENAI_API_KEY = this._opts.apiKey;
    }

    logger.info(`Spawning: ${this.command} ${args.join(' ')}`);

    this.process = spawn(this.command, args, {
      cwd: this._workspacePath!,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.buffer = '';
    let stderrBuffer = '';

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrBuffer += text;
      if (text.trim()) {
        logger.debug(`[codex stderr] ${text.trim()}`);
      }
    });

    this.process.on('close', (code) => {
      // Flush remaining buffer
      if (this.buffer.trim()) {
        try {
          const msg = JSON.parse(this.buffer.trim());
          this.handleMessage(msg);
        } catch {
          // Non-JSON remainder, log and discard
          logger.debug(`[codex] Non-JSON trailing buffer: ${this.buffer.trim()}`);
        }
        this.buffer = '';
      }
      if (code === 0) {
        this.setStatus('waiting');
      } else {
        this.setStatus('error');
        const errMsg = stderrBuffer.trim() || `Codex exited with code ${code}`;
        this.emit('error', new Error(errMsg));
      }
      this.process = null;
    });

    this.process.on('error', (err) => {
      this.setStatus('error');
      this.emit('error', err);
      this.process = null;
    });
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
        // With --json all real output is JSON; log non-JSON lines for diagnostics
        logger.debug(`[codex] Non-JSON line: ${line}`);
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    switch (type) {
      case 'thread.started': {
        const threadId = msg.thread_id as string;
        if (threadId) {
          this._sessionId = threadId;
          this.emit('session_id', threadId);
        }
        break;
      }

      case 'item.completed': {
        const item = msg.item as Record<string, unknown>;
        if (!item) break;

        const itemType = item.type as string;

        if (itemType === 'agent_message') {
          const text = item.text as string | undefined;
          if (text) {
            this.emitOutput('text', text);
          }
        } else if (itemType === 'command_execution') {
          const command = item.command as string | undefined;
          const commandArgs = item.args as unknown;
          this.emitOutput(
            'tool_call',
            JSON.stringify({
              command,
              args: Array.isArray(commandArgs) ? commandArgs : undefined,
            }),
            {
              toolName: 'command_execution',
            },
          );

          const output = item.aggregated_output;
          if (output != null) {
            this.emitOutput('tool_result', String(output), {
              toolName: 'command_execution',
              exitCode: item.exit_code,
            });
          }
        } else if (itemType === 'file_change') {
          this.emitOutput(
            'tool_call',
            JSON.stringify({
              file: item.file,
              action: item.action,
            }),
            {
              toolName: 'file_change',
            },
          );
        }
        break;
      }

      case 'turn.completed': {
        logger.debug('[codex] Turn completed');
        break;
      }

      case 'error': {
        const message = msg.message as string;
        if (message) {
          this.emitOutput('error', message);
        }
        break;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
    this.setStatus('stopped');
    logger.info('Codex stopped');
  }
}
