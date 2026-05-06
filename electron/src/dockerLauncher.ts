import path from 'node:path';
import { existsSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { getDockerCustomPath } from './dockerSettings';

const DAEMON_CHECK_TIMEOUT_MS = 3_000;
// Сколько ждём поднятия daemon после одного launch-метода. Если не успел —
// пробуем следующий метод. Худший случай — N методов × этот таймаут.
const METHOD_WAIT_TIMEOUT_MS = 20_000;
// Интервал polling'а: проверяем daemon раз в секунду.
const POLL_INTERVAL_MS = 1_000;

// Стандартный путь установки Docker Desktop на Windows.
const STANDARD_DOCKER_PATH = path.join(
  process.env.ProgramFiles ?? 'C:\\Program Files',
  'Docker',
  'Docker',
  'Docker Desktop.exe',
);

interface LaunchMethod {
  name: string;
  launch: () => void;
}

/**
 * Проверяет, отвечает ли Docker daemon. Best-effort: возвращает false при
 * любой ошибке (docker не установлен, daemon выключен, таймаут).
 */
export function checkDockerDaemon(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('docker', ['info'], { timeout: DAEMON_CHECK_TIMEOUT_MS }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Запускает Docker Desktop напрямую через путь к .exe.
 * `detached + ignore + unref` — fire-and-forget: Docker Desktop живёт сам по себе,
 * не привязан к нашему event loop, не умирает при выходе Electron'а.
 */
function spawnDockerExe(exePath: string): void {
  const child = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', (err) => {
    console.warn(`[dockerLauncher] Failed to spawn ${exePath}: ${err.message}`);
  });
  child.unref();
}

/**
 * Запуск через Windows shell `cmd /c start "" "Docker Desktop"`.
 * `start` с именем без расширения использует Windows App Paths registry —
 * Docker installer регистрирует там путь к exe. Работает с любым install
 * location, если у юзера штатная установка (registry-entry присутствует).
 */
function spawnDockerViaShell(): void {
  const child = spawn('cmd', ['/c', 'start', '""', 'Docker Desktop'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', (err) => {
    console.warn(`[dockerLauncher] Shell launch failed: ${err.message}`);
  });
  child.unref();
}

/**
 * macOS: `open -a Docker` ищет приложение в /Applications, надёжно работает.
 */
function spawnMacDocker(): void {
  const child = spawn('open', ['-a', 'Docker'], { detached: true, stdio: 'ignore' });
  child.on('error', (err) => {
    console.warn(`[dockerLauncher] open -a Docker failed: ${err.message}`);
  });
  child.unref();
}

/**
 * Linux: `pkexec systemctl start docker` показывает GUI password prompt
 * (через Polkit), запрашивает пароль root, после ввода стартует daemon.
 *
 * НЕ detached — pkexec должен жить пока юзер вводит пароль. Если юзер нажал
 * Cancel или ввёл неверный пароль → exit code != 0; logger пишет это, дальше
 * polling всё равно попробует подождать daemon (вдруг другой процесс поднял).
 */
function spawnLinuxDocker(): void {
  const child = spawn('pkexec', ['systemctl', 'start', 'docker'], { stdio: 'ignore' });
  child.on('error', (err) => {
    console.warn(`[dockerLauncher] pkexec systemctl start docker failed: ${err.message}`);
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.warn(`[dockerLauncher] pkexec exited with code ${code} (cancelled or wrong password)`);
    }
  });
}

/**
 * Возвращает упорядоченный список методов запуска для текущей платформы.
 * Каждый метод имеет имя (для логов) и launch-функцию (без ожидания).
 */
function getLaunchMethods(): LaunchMethod[] {
  if (process.platform === 'win32') {
    const methods: LaunchMethod[] = [];
    const customPath = getDockerCustomPath();
    if (customPath) {
      methods.push({
        name: `custom path: ${customPath}`,
        launch: () => spawnDockerExe(customPath),
      });
    }
    if (existsSync(STANDARD_DOCKER_PATH)) {
      methods.push({
        name: `standard path: ${STANDARD_DOCKER_PATH}`,
        launch: () => spawnDockerExe(STANDARD_DOCKER_PATH),
      });
    }
    methods.push({ name: 'shell + App Paths registry', launch: spawnDockerViaShell });
    return methods;
  }
  if (process.platform === 'darwin') {
    return [{ name: 'open -a Docker', launch: spawnMacDocker }];
  }
  if (process.platform === 'linux') {
    return [{ name: 'pkexec systemctl start docker', launch: spawnLinuxDocker }];
  }
  return [];
}

/**
 * Поллит Docker daemon до готовности или таймаута.
 */
function waitForDockerDaemon(timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      if (await checkDockerDaemon()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Docker daemon did not become ready within timeout'));
        return;
      }
      setTimeout(tryOnce, POLL_INTERVAL_MS);
    };
    tryOnce();
  });
}

/**
 * Sequential chain запуска: пробуем каждый метод по очереди, между попытками
 * ждём `METHOD_WAIT_TIMEOUT_MS` поднятия daemon. Если daemon поднялся — выходим.
 * Если все методы исчерпаны — daemon остаётся down, UI обработает.
 *
 * На Linux методов нет (массив пустой) — функция сразу возвращает с daemon=false,
 * UI покажет ручную инструкцию.
 */
export async function ensureDockerRunning(): Promise<void> {
  if (await checkDockerDaemon()) {
    console.log('[dockerLauncher] Docker daemon is already up');
    return;
  }
  const methods = getLaunchMethods();
  if (methods.length === 0) {
    console.log('[dockerLauncher] No auto-launch methods available on this platform');
    return;
  }
  console.log(
    `[dockerLauncher] Daemon down, trying ${methods.length} launch method(s) sequentially…`,
  );
  for (const method of methods) {
    console.log(`[dockerLauncher] Trying: ${method.name}`);
    method.launch();
    try {
      await waitForDockerDaemon(METHOD_WAIT_TIMEOUT_MS);
      console.log(`[dockerLauncher] Daemon up via "${method.name}"`);
      return;
    } catch {
      console.log(`[dockerLauncher] "${method.name}" timed out, trying next…`);
    }
  }
  console.warn('[dockerLauncher] All launch methods exhausted, daemon still down');
}
