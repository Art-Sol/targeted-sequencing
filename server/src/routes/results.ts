import { Router, Request, Response, NextFunction } from 'express';
import { getLatestResults } from '../services/resultsService.js';

// ============================================================
// Роутер
// ============================================================

const router = Router();

// ============================================================
// GET /api/results — результаты последнего запуска
// ============================================================

/**
 * Возвращает полный JSON последнего успешного запуска пайплайна.
 *
 * Логика выбора запуска:
 * - Ищем самую свежую папку в pipeline-workdir/output/
 * - Возвращаем содержимое её results.json
 *
 * Коды ответа:
 * - 200 — JSON результатов (PipelineResults)
 * - 404 — результаты ещё не созданы (пайплайн не запускался или упал)
 * - 500 — файл повреждён (невалидный JSON)
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await getLatestResults();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
