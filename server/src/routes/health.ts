import { Router, Request, Response } from 'express';
import { checkDocker, checkDaemon, checkImage } from '../services/dockerService.js';

// ============================================================
// Роутер
// ============================================================

const router = Router();

// ============================================================
// GET /api/health — проверка окружения (Docker + daemon + образ)
// ============================================================

router.get('/', async (_req: Request, res: Response) => {
  // 1. Установлен ли Docker CLI?
  const dockerInstalled = await checkDocker();

  if (!dockerInstalled) {
    res.json({
      status: 'error',
      docker: false,
      daemon: false,
      image: false,
      message: 'Docker не установлен',
    });
    return;
  }

  // 2. Запущен ли Docker daemon?
  const daemonRunning = await checkDaemon();

  if (!daemonRunning) {
    res.json({
      status: 'error',
      docker: true,
      daemon: false,
      image: false,
      message: 'Docker установлен, но не запущен',
    });
    return;
  }

  // 3. Загружен ли образ пайплайна?
  const imageLoaded = await checkImage();

  res.json({
    status: imageLoaded ? 'ok' : 'error',
    docker: true,
    daemon: true,
    image: imageLoaded,
    message: imageLoaded ? undefined : 'Docker-образ пайплайна не найден',
  });
});

export default router;
