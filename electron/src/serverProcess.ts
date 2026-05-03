import http from 'node:http';
import { spawn, execFile, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import {
  CLIENT_DIR,
  SERVER_DIR,
  SERVER_ENTRY,
  SERVER_HOST,
  TSX_CLI,
  VITE_CLI,
  VITE_PORT,
} from './consts';

/**
 * Резервирует свободный TCP-порт на 127.0.0.1.
 * Трюк: открываем сокет на :0 — ОС выдаёт свободный порт,
 * читаем его и сразу освобождаем. Окно гонки между close()
 * и `app.listen(port)` микросекундное.
 */
export function reserveFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, SERVER_HOST, () => {
      const addr = srv.address();
      if (typeof addr !== 'object' || addr === null) {
        reject(new Error('Failed to read assigned port'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

/**
 * 32 криптостойких байта → 64-символьная hex-строка (256 бит энтропии).
 * Используется для Bearer-токена auth-middleware.
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Спавним Express через системный node + tsx CLI напрямую (минуя tsx.cmd
 * на Windows — она требует shell:true, что плохо с путями с кириллицей/пробелами).
 *
 * `bundledImageTar`, если задан, пробрасывается в Express через env
 * `BUNDLED_IMAGE_TAR` — `/api/health` использует его для авто-загрузки образа.
 *
 * Каллер сам вешает обработчики `exit`/`error` — этот модуль не зависит от Electron.
 */
export function spawnServer(
  port: number,
  token: string,
  bundledImageTar?: string,
): ChildProcess {
  return spawn('node', [TSX_CLI, SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: SERVER_HOST,
      AUTH_TOKEN: token,
      ...(bundledImageTar ? { BUNDLED_IMAGE_TAR: bundledImageTar } : {}),
    },
    stdio: 'inherit',
    cwd: SERVER_DIR,
    // GUI-родитель (Electron) спавнит console-ребёнка (node) — без этого
    // Windows создаст ему отдельное чёрное окно консоли.
    windowsHide: true,
  });
}

/**
 * Спавним Vite dev-server для dev-режима Electron.
 * Передаём SERVER_PORT — Vite использует его в proxy-target для /api запросов.
 */
export function spawnVite(serverPort: number): ChildProcess {
  return spawn('node', [VITE_CLI, '--port', String(VITE_PORT)], {
    env: {
      ...process.env,
      SERVER_PORT: String(serverPort),
    },
    stdio: 'inherit',
    cwd: CLIENT_DIR,
    windowsHide: true,
  });
}

/**
 * Универсальный HTTP-poll: бьёт в URL пока не получим 2xx или таймаут.
 */
function waitForHttp(
  host: string,
  port: number,
  path: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.request(
        { host, port, path, method: 'GET', headers, timeout: 1000 },
        (res) => {
          if (res.statusCode && res.statusCode < 500) {
            res.resume();
            resolve();
            return;
          }
          res.resume();
          retry();
        },
      );
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
      req.end();
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Did not become ready within ${timeoutMs}ms (${host}:${port}${path})`));
        return;
      }
      setTimeout(tryOnce, 200);
    };
    tryOnce();
  });
}

/**
 * Поллит /api/health пока не получим 2xx или истечёт таймаут.
 * Шлёт Bearer-токен — иначе middleware вернёт 401.
 */
export function waitForServerReady(port: number, token: string, timeoutMs = 30_000) {
  return waitForHttp(
    SERVER_HOST,
    port,
    '/api/health',
    { Authorization: `Bearer ${token}` },
    timeoutMs,
  );
}

/**
 * Поллит Vite на /, без аутентификации. Vite серверу нужно ~секунду
 * на инициализацию плагинов и esbuild — без ожидания окно ловит ECONNREFUSED.
 */
export function waitForVite(timeoutMs = 30_000) {
  return waitForHttp('127.0.0.1', VITE_PORT, '/', {}, timeoutMs);
}

// ============================================================
// Graceful shutdown helpers
// ============================================================

interface PipelineStatusBrief {
  status: 'idle' | 'running' | 'done' | 'error';
  runId?: string;
}

/**
 * Best-effort: спрашивает у сервера статус пайплайна (нужен runId, чтобы знать
 * имя контейнера для docker stop). При любых проблемах — возвращает null,
 * shutdown продолжается без остановки контейнера.
 */
export function fetchPipelineStatus(
  port: number,
  token: string,
): Promise<PipelineStatusBrief | null> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: SERVER_HOST,
        port,
        path: '/api/pipeline/status',
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        timeout: 2000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as PipelineStatusBrief);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * `docker stop -t <timeout> <name>` — посылает контейнеру SIGTERM,
 * через timeoutSec форсит SIGKILL. Best-effort: ошибки логируются и игнорируются.
 *
 * Используется как кросс-платформенный путь остановки контейнера
 * (на Windows process.kill('SIGTERM') в Express — это force-kill, и handler
 * stopRunningContainer в сервере не запустится).
 */
export function dockerStop(containerName: string, timeoutSec = 5): Promise<void> {
  return new Promise((resolve) => {
    execFile('docker', ['stop', '-t', String(timeoutSec), containerName], (err) => {
      if (err) console.warn(`[serverProcess] docker stop ${containerName} failed: ${err.message}`);
      resolve();
    });
  });
}

/**
 * Ждёт `exit` процесса с таймаутом. Если процесс уже мёртв — резолвится сразу.
 * Если не успел за timeoutMs — резолвится без ожидания (caller сам форсит).
 */
export function waitForProcessExit(proc: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
