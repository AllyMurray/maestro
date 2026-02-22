import { spawn, ChildProcess } from 'child_process';
import type { AgentOpts, AgentType } from '@maestro/shared';
import { BaseAgentManager } from './BaseAgentManager';
import { logger } from '../logger';

export class ClaudeCodeManager extends BaseAgentManager {
  readonly type: AgentType = 'claude-code';
  readonly displayName = 'Claude Code';
  readonly command = 'claude';

  private process: ChildProcess | null = null;
  private buffer = '';

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
    this.setStatus('starting');

    const args: string[] = [
      '-p', '',  // Will be filled on send
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.resumeSessionId) {
      args.push('--resume', opts.resumeSessionId);
    }

    if (opts.permissions === 'skip') {
      args.push('--dangerously-skip-permissions');
    }

    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (opts.apiKey) {
      env.ANTHROPIC_API_KEY = opts.apiKey;
    }

    this.setStatus('running');
    logger.info(`Claude Code started in ${workspacePath}`);
  }

  async send(prompt: string): Promise<void> {
    if (this._status === 'stopped' || this._status === 'error') {
      throw new Error('Agent is not running');
    }

    this.setStatus('running');

    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (this._sessionId) {
      args.push('--resume', this._sessionId);
    }

    const env: Record<string, string> = { ...process.env as Record<string, string> };

    this.process = spawn(this.command, args, {
      cwd: this._workspacePath!,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.buffer = '';

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        logger.debug(`[claude stderr] ${text}`);
      }
    });

    this.process.on('close', (code) => {
      if (code === 0) {
        this.setStatus('waiting');
      } else {
        this.setStatus('error');
        this.emit('error', new Error(`Claude Code exited with code ${code}`));
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
        // Not valid JSON, might be partial output
        logger.debug(`[claude] Non-JSON line: ${line}`);
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    switch (type) {
      case 'system': {
        // Extract session ID
        const sessionId = msg.session_id as string;
        if (sessionId) {
          this._sessionId = sessionId;
          this.emit('session_id', sessionId);
        }
        break;
      }

      case 'assistant': {
        const content = msg.message as Record<string, unknown>;
        if (content) {
          const contentBlocks = content.content as Array<Record<string, unknown>>;
          if (Array.isArray(contentBlocks)) {
            for (const block of contentBlocks) {
              if (block.type === 'text') {
                this.emitOutput('text', block.text as string);
              } else if (block.type === 'tool_use') {
                this.emitOutput('tool_call', JSON.stringify(block), {
                  toolName: block.name as string,
                  toolId: block.id as string,
                });
              }
            }
          }
        }
        break;
      }

      case 'content_block_delta': {
        const delta = msg.delta as Record<string, unknown>;
        if (delta?.type === 'text_delta') {
          this.emitOutput('text', delta.text as string);
        }
        break;
      }

      case 'result': {
        const result = msg.result as string;
        if (result) {
          this.emitOutput('text', result);
        }
        const sessionId = msg.session_id as string;
        if (sessionId) {
          this._sessionId = sessionId;
          this.emit('session_id', sessionId);
        }
        break;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      // Wait a bit, then force kill
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
    this.setStatus('stopped');
    logger.info('Claude Code stopped');
  }
}
