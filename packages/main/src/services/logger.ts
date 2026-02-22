import fs from 'fs';
import path from 'path';
import os from 'os';
import { DATA_DIR_NAME, LOG_DIR_NAME } from '@maestro/shared';

function getLogDir(): string {
  const baseDir = process.env.MAESTRO_TEST_DATA_DIR || path.join(os.homedir(), DATA_DIR_NAME);
  return path.join(baseDir, LOG_DIR_NAME);
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

let logStream: fs.WriteStream | null = null;

export function initLogger(): void {
  const logDir = getLogDir();
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `maestro-${new Date().toISOString().split('T')[0]}.log`);
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
}

function writeLog(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ' ' + args.map((a) => JSON.stringify(a)).join(' ') : '';
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}\n`;

  if (logStream) {
    logStream.write(line);
  }

  if (level === 'error') {
    console.error(line.trimEnd());
  } else if (process.env.MAESTRO_DEV === '1') {
    console.log(line.trimEnd());
  }
}

export const logger = {
  info: (message: string, ...args: unknown[]) => writeLog('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => writeLog('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => writeLog('error', message, ...args),
  debug: (message: string, ...args: unknown[]) => writeLog('debug', message, ...args),
};
