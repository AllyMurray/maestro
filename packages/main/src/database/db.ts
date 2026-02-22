import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { DATA_DIR_NAME, DB_FILENAME } from '@maestro/shared';
import { runMigrations } from './migrations';

function getDbPath(): string {
  const baseDir = process.env.MAESTRO_TEST_DATA_DIR || path.join(os.homedir(), DATA_DIR_NAME);
  return path.join(baseDir, DB_FILENAME);
}

let db: Database.Database | null = null;

export function initDatabase(): void {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
