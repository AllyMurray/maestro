import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

let electronProc: ChildProcess | null = null;

function startVite(): ChildProcess {
  console.log('[dev] Starting Vite dev server...');
  const vite = spawn('pnpm', ['--filter', '@maestro/renderer', 'dev'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
  });

  vite.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(`[vite] ${text}`);
    if (text.includes('Local:') && !electronProc) {
      startElectron();
    }
  });

  vite.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.error(`[vite] ${text}`);
  });

  return vite;
}

function startElectron(): void {
  console.log('[dev] Starting Electron...');

  // Build main process first
  const build = spawn('pnpm', ['--filter', '@maestro/main', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  build.on('close', (code) => {
    if (code !== 0) {
      console.error('[dev] Main process build failed');
      process.exit(1);
    }

    electronProc = spawn(
      'pnpm',
      ['exec', 'electron', 'packages/main/dist/index.js'],
      {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          MAESTRO_DEV: '1',
          VITE_DEV_SERVER_URL: 'http://localhost:5173',
        },
      },
    );

    electronProc.on('close', () => {
      console.log('[dev] Electron closed');
      process.exit(0);
    });
  });
}

const viteProc = startVite();

process.on('SIGINT', () => {
  viteProc.kill();
  electronProc?.kill();
  process.exit(0);
});
