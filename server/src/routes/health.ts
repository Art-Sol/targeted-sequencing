import { Router, Request, Response } from 'express';
import {
  checkDocker,
  checkDaemon,
  checkImage,
  loadImageFromTar,
  getImageLoadingStatus,
  getImageLoadError,
  clearImageLoadError,
} from '../services/dockerService.js';
import { BadRequestError } from '../errors.js';

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
      imageLoading: false,
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
      imageLoading: false,
      message: 'Docker установлен, но не запущен',
    });
    return;
  }

  // 3. Загружен ли образ пайплайна?
  const imageLoaded = await checkImage();

  // Lazy auto-load: если образа нет, есть bundled tar, не идёт загрузка
  // и нет накопившейся ошибки — стартуем `docker load` в фоне.
  // После провала auto-retry заблокирован — иначе UI поллит, мы запускаем,
  // фейлим, повторяем → лог-спам. Юзер должен явно retry'ить через
  // POST /api/health/retry-image-load (или перезапустить приложение).
  const bundledTar = process.env.BUNDLED_IMAGE_TAR;
  const wasLoading = getImageLoadingStatus();
  const imageLoadError = getImageLoadError();
  if (!imageLoaded && bundledTar && !wasLoading && !imageLoadError) {
    loadImageFromTar(bundledTar).catch((err) => {
      console.error('[health] Background image load failed:', err.message);
    });
  }

  // Перечитываем после возможного запуска: тело async-функции до первого
  // await исполняется синхронно, так что `imageLoading=true` уже выставлен.
  // Без этого первый ответ соврёт `imageLoading=false` → клиент не запустит
  // polling и не покажет экран загрузки.
  const imageLoading = getImageLoadingStatus();

  res.json({
    status: imageLoaded ? 'ok' : 'error',
    docker: true,
    daemon: true,
    image: imageLoaded,
    imageLoading,
    imageLoadError: imageLoadError ?? undefined,
    message: imageLoaded
      ? undefined
      : imageLoading
        ? 'Загрузка Docker-образа из локального архива…'
        : imageLoadError
          ? `Не удалось загрузить образ: ${imageLoadError}`
          : 'Docker-образ пайплайна не найден',
  });
});

// ============================================================
// POST /api/health/retry-image-load — явный retry загрузки образа
// ============================================================
//
// Сбрасывает error и стартует новую попытку. Используется UI'ем после
// того, как юзер заменил повреждённый tar на корректный.

router.post('/retry-image-load', (_req: Request, res: Response) => {
  const bundledTar = process.env.BUNDLED_IMAGE_TAR;
  if (!bundledTar) {
    throw new BadRequestError('Bundled image tar is not configured');
  }
  clearImageLoadError();
  loadImageFromTar(bundledTar).catch((err) => {
    console.error('[health] Manual retry image load failed:', err.message);
  });
  res.json({ status: 'started' });
});

export default router;
