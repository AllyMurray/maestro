import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockFs: Record<string, string> = {};

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: vi.fn((p: string) => p in mockFs),
    readFileSync: vi.fn((p: string) => mockFs[p] || ''),
    writeFileSync: vi.fn((p: string, data: string) => {
      mockFs[p] = data;
    }),
  },
  mkdirSync: vi.fn(),
  existsSync: vi.fn((p: string) => p in mockFs),
  readFileSync: vi.fn((p: string) => mockFs[p] || ''),
  writeFileSync: vi.fn((p: string, data: string) => {
    mockFs[p] = data;
  }),
}));

describe('configManager', () => {
  beforeEach(async () => {
    mockFs = {};
    vi.resetModules();
  });

  it('initializes with empty config when no file exists', async () => {
    const { initConfig, getAllConfig } = await import('./configManager');
    initConfig();
    expect(getAllConfig()).toEqual({});
  });

  it('loads existing config from file', async () => {
    // Pre-populate mock filesystem
    const configData = { api_key: 'test-key', theme: 'dark' };
    // Set all paths to have the config
    Object.keys(mockFs).forEach((k) => delete mockFs[k]);
    // We need to set the right path - use a catch-all approach
    const os = await import('os');
    const path = await import('path');
    const configPath = path.join(os.homedir(), '.maestro', 'config.json');
    mockFs[configPath] = JSON.stringify(configData);

    const { initConfig, getAllConfig } = await import('./configManager');
    initConfig();
    expect(getAllConfig()).toEqual(configData);
  });

  it('get returns value for existing key', async () => {
    const { initConfig, setConfig, getConfig } = await import('./configManager');
    initConfig();
    setConfig('myKey', 'myValue');
    expect(getConfig('myKey')).toBe('myValue');
  });

  it('get returns null for missing key', async () => {
    const { initConfig, getConfig } = await import('./configManager');
    initConfig();
    expect(getConfig('nonexistent')).toBeNull();
  });

  it('set persists value and getAll reflects it', async () => {
    const { initConfig, setConfig, getAllConfig } = await import('./configManager');
    initConfig();
    setConfig('key1', 'val1');
    setConfig('key2', 'val2');
    expect(getAllConfig()).toEqual({ key1: 'val1', key2: 'val2' });
  });

  it('delete removes a key', async () => {
    const { initConfig, setConfig, deleteConfig, getConfig } = await import('./configManager');
    initConfig();
    setConfig('toDelete', 'value');
    expect(getConfig('toDelete')).toBe('value');
    deleteConfig('toDelete');
    expect(getConfig('toDelete')).toBeNull();
  });

  it('getAllConfig returns a copy, not a reference', async () => {
    const { initConfig, setConfig, getAllConfig } = await import('./configManager');
    initConfig();
    setConfig('key', 'val');
    const config = getAllConfig();
    config.key = 'modified';
    expect(getAllConfig().key).toBe('val');
  });
});
