import Database from 'better-sqlite3';
import { runMigrations } from '../database/migrations';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

/**
 * Creates a mock for '../database/db' that uses an in-memory database.
 * Usage: vi.mock('../database/db', () => createDbMock());
 */
export function createDbMock() {
  const db = createTestDb();
  return {
    getDb: () => db,
    initDatabase: vi.fn(),
    closeDb: () => db.close(),
    __testDb: db,
  };
}
