import { contextBridge, ipcRenderer } from 'electron';

// ============================================================
// appConfig — конфиг приложения, переданный из main через additionalArguments
// ============================================================
//
// Ищем `--config-b64=<base64>` в process.argv (туда Electron помещает
// `additionalArguments` из webPreferences) и декодируем JSON-конфиг.

const PREFIX = '--config-b64=';
const arg = process.argv.find((a) => a.startsWith(PREFIX));
const decoded = arg ? Buffer.from(arg.slice(PREFIX.length), 'base64').toString('utf8') : '{}';
const config = JSON.parse(decoded) as { token?: string };

contextBridge.exposeInMainWorld('appConfig', config);

// ============================================================
// electronAPI — IPC-мост к main process
// ============================================================
//
// Renderer'у нужен доступ к Electron-специфичным операциям (управление
// Docker'ом, инфо о платформе) через узкий, типизированный API. contextBridge
// — единственный безопасный способ это сделать при contextIsolation: true.

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getDockerCustomPath: () => ipcRenderer.invoke('docker:getCustomPath') as Promise<string | null>,
  setDockerCustomPath: (p: string) =>
    ipcRenderer.invoke('docker:setCustomPath', p) as Promise<void>,
  retryDockerLaunch: () =>
    ipcRenderer.invoke('docker:retry') as Promise<{ daemonUp: boolean }>,
});
