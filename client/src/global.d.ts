// Глобальные конфиги, которые Electron preload-скрипт выставляет в `window`
// через `contextBridge.exposeInMainWorld`. В browser-dev режиме (без Electron)
// эти поля отсутствуют — отсюда optional.

interface AppConfig {
  token?: string;
}

interface ElectronAPI {
  /** ОС, на которой запущен Electron-процесс. Используется UI для условного рендера. */
  platform: 'win32' | 'darwin' | 'linux' | 'aix' | 'freebsd' | 'openbsd' | 'sunos';
  /** Возвращает сохранённый customPath к Docker Desktop (без проверки existsSync). */
  getDockerCustomPath: () => Promise<string | null>;
  /** Сохраняет customPath к Docker Desktop в persistent settings. */
  setDockerCustomPath: (path: string) => Promise<void>;
  /** Перезапускает попытку поднять Docker daemon. Возвращает финальный статус. */
  retryDockerLaunch: () => Promise<{ daemonUp: boolean }>;
}

interface Window {
  appConfig?: AppConfig;
  electronAPI?: ElectronAPI;
}
