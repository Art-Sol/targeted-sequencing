import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import type { ChildProcess } from 'node:child_process';

let logFilePath: string | null = null;

/**
 * Перехватывает console.log/warn/error и дублирует их в файл логов.
 * Используем СИНХРОННЫЕ записи (appendFileSync) — иначе при крахе main-процесса
 * буфер WriteStream не успевает flushed на диск, и мы теряем именно ту строку,
 * которая объясняет падение.
 *
 * Путь: %APPDATA%/<productName>/logs/main.log. Если app.getPath('userData')
 * не доступен (редко, но возможно до setName) — fallback на os.tmpdir.
 */
export function initLogger(): string {
  if (logFilePath) return logFilePath;

  let dir: string;
  try {
    dir = path.join(app.getPath('userData'), 'logs');
  } catch {
    dir = path.join(os.tmpdir(), 'targeted-sequencing', 'logs');
  }
  fs.mkdirSync(dir, { recursive: true });
  logFilePath = path.join(dir, 'main.log');

  // Маркер старта — гарантирует что файл существует ещё до первой console-строки.
  appendSync(`\n=== process start: ${new Date().toISOString()} pid=${process.pid} ===\n`);

  const wrap = (level: string, orig: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      appendSync(
        `[${new Date().toISOString()}] [${level}] ${args.map(formatArg).join(' ')}\n`,
      );
      orig(...args);
    };

  console.log = wrap('LOG', console.log.bind(console));
  console.warn = wrap('WARN', console.warn.bind(console));
  console.error = wrap('ERR', console.error.bind(console));

  process.on('uncaughtException', (err) => {
    appendSync(
      `[${new Date().toISOString()}] [UNCAUGHT] ${err.stack || err.message}\n`,
    );
  });
  process.on('unhandledRejection', (reason) => {
    appendSync(
      `[${new Date().toISOString()}] [UNHANDLED] ${formatArg(reason)}\n`,
    );
  });

  return logFilePath;
}

/**
 * Подключает stdout/stderr дочернего процесса к лог-файлу с префиксом.
 * Требует, чтобы child был спавнен с stdio: 'pipe'.
 */
export function pipeChildToLog(child: ChildProcess, name: string): void {
  child.stdout?.on('data', (chunk: Buffer) => {
    appendSync(`[${name}/out] ${chunk.toString()}`);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    appendSync(`[${name}/err] ${chunk.toString()}`);
  });
}

function appendSync(line: string): void {
  if (!logFilePath) return;
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {
    // Не падаем если файл недоступен — логгер не должен ронять приложение.
  }
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}
