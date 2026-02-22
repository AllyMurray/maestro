import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockDatabase() {
  function Database() {
    return {
      pragma: vi.fn(),
      prepare: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }),
      exec: vi.fn(),
      close: vi.fn(),
      transaction: vi.fn((fn: any) => fn),
    };
  }
  return Database;
}

describe('db module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getDb throws when not initialized', async () => {
    const { getDb } = await import('./db');
    expect(() => getDb()).toThrow('Database not initialized');
  });

  it('initDatabase creates and returns a working DB', async () => {
    vi.doMock('fs', () => ({
      default: { mkdirSync: vi.fn() },
      mkdirSync: vi.fn(),
    }));
    vi.doMock('better-sqlite3', () => ({ default: createMockDatabase() }));
    vi.doMock('./migrations', () => ({ runMigrations: vi.fn() }));

    const { initDatabase, getDb } = await import('./db');
    initDatabase();
    expect(() => getDb()).not.toThrow();
  });

  it('closeDb sets db to null', async () => {
    vi.doMock('fs', () => ({
      default: { mkdirSync: vi.fn() },
      mkdirSync: vi.fn(),
    }));
    vi.doMock('better-sqlite3', () => ({ default: createMockDatabase() }));
    vi.doMock('./migrations', () => ({ runMigrations: vi.fn() }));

    const { initDatabase, closeDb, getDb } = await import('./db');
    initDatabase();
    closeDb();
    expect(() => getDb()).toThrow('Database not initialized');
  });
});
