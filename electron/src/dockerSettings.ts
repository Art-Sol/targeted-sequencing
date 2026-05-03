import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Persistent settings в стандартном месте Electron-приложений:
// Windows: %APPDATA%/<appName>/docker-settings.json
// macOS: ~/Library/Application Support/<appName>/docker-settings.json
// Linux: ~/.config/<appName>/docker-settings.json
//
// Хранение пути к Docker Desktop.exe — для случая, когда у юзера
// нестандартный install location и наши авто-методы (ProgramFiles, App Paths)
// его не нашли.

const settingsFile = () => path.join(app.getPath('userData'), 'docker-settings.json');

interface Settings {
  dockerPath?: string;
}

function readSettings(): Settings {
  try {
    return JSON.parse(readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Возвращает сохранённый путь к Docker Desktop.exe только если файл
 * существует. Если путь сохранён, но файла нет (юзер удалил/переместил Docker),
 * возвращаем null — caller fallback на другие методы поиска.
 */
export function getDockerCustomPath(): string | null {
  const dockerPath = readSettings().dockerPath;
  if (dockerPath && existsSync(dockerPath)) return dockerPath;
  return null;
}

/**
 * Возвращает «сырой» сохранённый путь без проверки existsSync.
 * Нужен UI, чтобы предзаполнить input даже если путь сейчас невалиден.
 */
export function getRawDockerCustomPath(): string | null {
  return readSettings().dockerPath ?? null;
}

export function setDockerCustomPath(filePath: string): void {
  writeFileSync(settingsFile(), JSON.stringify({ dockerPath: filePath }, null, 2));
}
