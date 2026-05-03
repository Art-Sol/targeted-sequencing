import type { Server } from 'node:http';
import { stopRunningContainer } from './services/dockerService.js';

/**
 * Регистрирует SIGTERM/SIGINT handler'ы для graceful shutdown.
 *
 * Цепочка действий при сигнале:
 *   1. httpServer.close() — перестаём принимать новые соединения,
 *      ждём окончания in-flight запросов
 *   2. stopRunningContainer() — `docker stop pipeline-...` если жив
 *   3. process.exit(0)
 *
 * SIGTERM шлёт `kill <pid>`, init system, наш Electron parent (на Unix).
 * SIGINT шлёт Ctrl+C в терминале — нужен для случая, когда сервер
 * запущен standalone (npm run dev:server) и разработчик завершает его руками.
 *
 * На Windows `child.kill('SIGTERM')` от Electron'а — это force-kill, эти
 * handler'ы не вызовутся. За остановку контейнера на Windows отвечает
 * Electron main process (он напрямую зовёт `docker stop` до kill сервера).
 *
 * Вызывать ОДИН раз после старта HTTP-сервера, передав ссылку на него.
 */
export function registerGracefulShutdown(httpServer: Server): void {
  async function shutdown(signal: string): Promise<never> {
    console.log(`[server] Received ${signal}, shutting down…`);
    httpServer.close();
    await stopRunningContainer();
    process.exit(0);
  }

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(() => process.exit(1));
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(() => process.exit(1));
  });
}
