import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ChildProcess } from 'node:child_process';
import { SERVER_HOST, VITE_PORT, BUNDLED_IMAGE_TAR_NAME, RESOURCES_DIR_DEV } from './consts';
import {
  reserveFreePort,
  generateToken,
  spawnServer,
  spawnVite,
  waitForServerReady,
  waitForVite,
  fetchPipelineStatus,
  dockerStop,
  waitForProcessExit,
} from './serverProcess';
import { ensureDockerRunning, checkDockerDaemon } from './dockerLauncher';
import { getRawDockerCustomPath, setDockerCustomPath } from './dockerSettings';

// IPC handlers для управления Docker'ом из renderer'а.
// Регистрируем на module-level (до whenReady) — ipcMain singleton
// доступен сразу, и handlers будут готовы к моменту, когда renderer
// начнёт делать invoke'ы.
ipcMain.handle('docker:getCustomPath', () => getRawDockerCustomPath());
ipcMain.handle('docker:setCustomPath', (_event, customPath: string) => {
  setDockerCustomPath(customPath);
});
ipcMain.handle('docker:retry', async () => {
  await ensureDockerRunning();
  return { daemonUp: await checkDockerDaemon() };
});

// Module-level state. Нужно нескольким event handler'ам (whenReady,
// before-quit, activate), поэтому хранится на уровне модуля.
let serverProcess: ChildProcess | null = null;
let viteProcess: ChildProcess | null = null;
let token: string | null = null;
let port: number | null = null;
let appUrl: string | null = null;
// Защита от повторного срабатывания before-quit (мы зовём preventDefault → app.quit
// → событие повторяется → бесконечный цикл без флага).
let isQuitting = false;

function createWindow() {
  if (!appUrl || !token) throw new Error('appUrl/token must be set before createWindow');
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Таргетное секвенирование',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      // Конфиг в base64 — ASCII без `:`/`/`, не «съедается» Chromium-парсером.
      additionalArguments: [
        `--config-b64=${Buffer.from(JSON.stringify({ token })).toString('base64')}`,
      ],
    },
  });

  win.loadURL(appUrl);
}

app.whenReady().then(async () => {
  try {
    port = await reserveFreePort();
    token = generateToken();

    // Путь к bundled tar c Docker-образом. Передаём только если файл
    // реально лежит на месте — иначе Express не пытается auto-load.
    const bundledTar = path.join(
      app.isPackaged ? process.resourcesPath : RESOURCES_DIR_DEV,
      BUNDLED_IMAGE_TAR_NAME,
    );
    const bundledTarToPass = existsSync(bundledTar) ? bundledTar : undefined;

    console.log(`[main] Reserved port ${port}, spawning Express…`);

    serverProcess = spawnServer(port, token, bundledTarToPass);

    serverProcess.on('exit', (code, signal) => {
      console.error(`[main] Express exited (code=${code}, signal=${signal})`);
      // Если сервер упал не от нашей руки — гасим приложение.
      // isQuitting защищает от повторного срабатывания во время shutdown.
      if (!isQuitting && (code !== 0 || !app.isReady())) app.quit();
    });

    await waitForServerReady(port, token);

    console.log('[main] Express is ready');

    // Dev — Vite serves UI на 5173, проксирует /api на Express.
    // Prod — Express serves UI как статику + /api на том же порту.
    if (!app.isPackaged) {
      console.log('[main] Dev mode - spawning Vite...');

      viteProcess = spawnVite(port);
      viteProcess.on('exit', (code, signal) => {
        console.error(`[main] Vite exited (code=${code}, signal=${signal})`);
        if (!isQuitting && (code !== 0 || !app.isReady())) app.quit();
      });

      await waitForVite();

      console.log('[main] Vite is ready');

      appUrl = `http://localhost:${VITE_PORT}`;
    } else {
      appUrl = `http://${SERVER_HOST}:${port}`;
    }

    createWindow();
  } catch (err) {
    console.error('[main] Failed to start:', err);
    app.quit();
  }
});

// ============================================================
// Graceful shutdown
// ============================================================
//
// Последовательность:
//   1. preventDefault — не даём Electron'у выйти сразу
//   2. Спрашиваем у Express статус пайплайна (через HTTP с auth)
//   3. Если контейнер пайплайна жив — `docker stop pipeline-<runId>`
//      (кросс-платформенно: на Windows kill('SIGTERM') Express'а — это force-kill,
//       handler сервера не сработает, поэтому контейнер останавливаем сами)
//   4. SIGTERM Vite + Express
//   5. Ждём exit ребёнка с таймаутом 3 сек
//   6. app.quit() — на этот раз пройдёт благодаря isQuitting

app.on('before-quit', async (event) => {
  if (isQuitting) return;
  // Если процесс уже мёртв — нечего чистить
  if (!serverProcess || serverProcess.exitCode !== null) {
    isQuitting = true;
    return;
  }

  event.preventDefault();
  console.log('[main] Graceful shutdown initiated...');

  try {
    if (token !== null && port !== null) {
      const status = await fetchPipelineStatus(port, token);
      if (status?.status === 'running' && status.runId) {
        console.log(`[main] Stopping container pipeline: ${status.runId}…`);
        await dockerStop(`pipeline-${status.runId}`);
      }
    }
  } catch (err) {
    console.warn('[main] Pre-quit cleanup error (ignored):', err);
  }

  if (viteProcess && !viteProcess.killed) viteProcess.kill('SIGTERM');
  if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGTERM');

  await waitForProcessExit(serverProcess, 3_000);

  isQuitting = true;
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && appUrl) createWindow();
});
