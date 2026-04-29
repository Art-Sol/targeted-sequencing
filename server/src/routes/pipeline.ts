import { Router, Request, Response, NextFunction } from 'express';
import { runPipeline, getPipelineStatus } from '../services/dockerService.js';
import { validateUploadedFiles } from '../services/fileService.js';

// ============================================================
// Роутер
// ============================================================

const router = Router();

// ============================================================
// POST /api/pipeline/run — запуск анализа
// ============================================================

router.post('/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Валидация: все ли файлы загружены?
    const validation = await validateUploadedFiles();

    if (!validation.valid) {
      res.status(400).json({
        error: 'Не все файлы загружены',
        missingFiles: validation.missingFiles,
        errors: validation.errors,
      });
      return;
    }

    // 2. Запуск пайплайна
    const { runId } = await runPipeline();

    res.json({ message: 'Анализ запущен', runId });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/pipeline/status — текущий статус пайплайна
// ============================================================

router.get('/status', (_req: Request, res: Response) => {
  res.json(getPipelineStatus());
});

export default router;
