import { EventEmitter } from 'events';
import type { AgentType, AgentOpts, AgentOutput, AgentStatus } from '@maestro/shared';

export abstract class BaseAgentManager extends EventEmitter {
  abstract readonly type: AgentType;
  abstract readonly displayName: string;
  abstract readonly command: string;

  protected _status: AgentStatus = 'idle';
  protected _sessionId: string | null = null;
  protected _workspacePath: string | null = null;

  get status(): AgentStatus {
    return this._status;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  protected setStatus(status: AgentStatus): void {
    this._status = status;
    this.emit('status', status);
  }

  abstract isAvailable(): Promise<boolean>;
  abstract start(workspacePath: string, opts: AgentOpts): Promise<void>;
  abstract send(prompt: string): Promise<void>;
  abstract stop(): Promise<void>;

  // Typed event methods
  on(event: 'output', cb: (data: AgentOutput) => void): this;
  on(event: 'status', cb: (status: AgentStatus) => void): this;
  on(event: 'error', cb: (err: Error) => void): this;
  on(event: 'session_id', cb: (id: string) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, cb: (...args: any[]) => void): this {
    return super.on(event, cb);
  }

  protected emitOutput(
    type: AgentOutput['type'],
    content: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.emit('output', {
      type,
      content,
      metadata,
      timestamp: new Date().toISOString(),
    } satisfies AgentOutput);
  }
}
