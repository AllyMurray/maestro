import fs from 'fs';
import path from 'path';
import os from 'os';
import { DATA_DIR_NAME, CONFIG_FILENAME } from '@maestro/shared';

function getConfigPath(): string {
  const baseDir = process.env.MAESTRO_TEST_DATA_DIR || path.join(os.homedir(), DATA_DIR_NAME);
  return path.join(baseDir, CONFIG_FILENAME);
}

let config: Record<string, string> = {};

export function initConfig(): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw);
  } else {
    config = {};
    saveConfigFile();
  }
}

function saveConfigFile(): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getConfig(key: string): string | null {
  return config[key] ?? null;
}

export function setConfig(key: string, value: string): void {
  config[key] = value;
  saveConfigFile();
}

export function getAllConfig(): Record<string, string> {
  return { ...config };
}

export function deleteConfig(key: string): void {
  delete config[key];
  saveConfigFile();
}
