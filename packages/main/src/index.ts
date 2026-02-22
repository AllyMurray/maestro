import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerAllIpcHandlers } from './ipc/index';
import { initDatabase } from './database/db';
import { initLogger, logger } from './services/logger';
import { initConfig } from './services/configManager';

const isDev = process.env.MAESTRO_DEV === '1';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1a1b1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initServices(): Promise<void> {
  initLogger();
  logger.info('Maestro starting...');

  initConfig();
  logger.info('Config loaded');

  initDatabase();
  logger.info('Database initialized');

  registerAllIpcHandlers(ipcMain);
  logger.info('IPC handlers registered');
}

app.whenReady().then(async () => {
  await initServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  logger.info('Maestro shutting down...');
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
