import type { MaestroAPI } from '../../src/types/window';

function getApi(): MaestroAPI {
  if (typeof window !== 'undefined' && window.maestro) {
    return window.maestro;
  }
  // Fallback for dev without Electron
  return {
    invoke: async () => {
      console.warn('IPC not available outside Electron');
      return null as never;
    },
    on: () => () => {},
    send: () => {},
  };
}

export const ipc = {
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    return getApi().invoke<T>(channel, ...args);
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    return getApi().on(channel, callback);
  },
  send: (channel: string, ...args: unknown[]): void => {
    getApi().send(channel, ...args);
  },
};
