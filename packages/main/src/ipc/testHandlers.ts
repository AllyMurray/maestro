import { IpcMain } from 'electron';
import { EventEmitter } from 'events';
import { setCreateAgentManagerOverrideForTests } from '../services/agents/AgentManagerFactory';
import { setDiscoverAgentsOverrideForTests } from '../services/agents/AgentRegistry';

/**
 * Registers test-only IPC handlers. Only active when MAESTRO_TEST=1.
 */
export function registerTestHandlers(ipcMain: IpcMain): void {
  if (process.env.MAESTRO_TEST !== '1') return;

  ipcMain.handle('test:install-mock-agent', async () => {
    setCreateAgentManagerOverrideForTests(() => {
      const emitter = new EventEmitter() as any;
      emitter.type = 'claude-code';
      emitter.displayName = 'Claude Code (Mock)';
      emitter.command = 'claude';
      emitter._status = 'idle';

      Object.defineProperty(emitter, 'status', {
        get() {
          return emitter._status;
        },
      });

      emitter.isAvailable = async () => true;

      emitter.start = async () => {
        emitter._status = 'waiting';
        emitter.emit('status', 'waiting');
        emitter.emit('session_id', 'mock-session-id');
      };

      emitter.send = async (prompt: string) => {
        emitter._status = 'running';
        emitter.emit('status', 'running');

        setTimeout(() => {
          emitter.emit('output', {
            type: 'text',
            content: `Echo: ${prompt}`,
            timestamp: new Date().toISOString(),
          });
          emitter._status = 'waiting';
          emitter.emit('status', 'waiting');
        }, 100);
      };

      emitter.stop = async () => {
        emitter._status = 'idle';
        emitter.emit('status', 'idle');
      };

      return emitter;
    });

    setDiscoverAgentsOverrideForTests(async () => [
      {
        type: 'claude-code',
        displayName: 'Claude Code',
        command: 'claude',
        available: true,
        version: '1.0.0-mock',
      },
      { type: 'codex', displayName: 'Codex', command: 'codex', available: false },
      { type: 'cursor', displayName: 'Cursor', command: 'cursor', available: false },
    ]);

    return { success: true };
  });
}
