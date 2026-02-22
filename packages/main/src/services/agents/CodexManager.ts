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

    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (opts.apiKey) {
      env.OPENAI_API_KEY = opts.apiKey;
    }

    this.setStatus('running');
    logger.info(`Codex started in ${workspacePath}`);
  }

  async send(prompt: string): Promise<void> {
    if (this._status === 'stopped' || this._status === 'error') {
      throw new Error('Agent is not running');
    }

    this.setStatus('running');

    const args: string[] = ['--quiet', prompt];

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
        logger.debug(`[codex stderr] ${text}`);
      }
    });

    this.process.on('close', (code) => {
      // Flush remaining buffer
      if (this.buffer.trim()) {
        this.emitOutput('text', this.buffer.trim());
        this.buffer = '';
      }
      if (code === 0) {
        this.setStatus('waiting');
      } else {
        this.setStatus('error');
        this.emit('error', new Error(`Codex exited with code ${code}`));
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
        // Plain text output
        this.emitOutput('text', line);
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    switch (type) {
      case 'message': {
        const content = msg.content as string;
        if (content) {
          this.emitOutput('text', content);
        }
        break;
      }

      case 'function_call': {
        this.emitOutput('tool_call', JSON.stringify(msg), {
          toolName: msg.name as string,
        });
        break;
      }

      case 'function_call_output': {
        this.emitOutput('tool_result', msg.output as string, {
          toolName: msg.name as string,
        });
        break;
      }

      default: {
        // Raw text content
        if (msg.content) {
          this.emitOutput('text', String(msg.content));
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
