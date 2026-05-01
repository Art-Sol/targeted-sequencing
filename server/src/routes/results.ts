import { Router, Request, Response, NextFunction } from 'express';
import {
  deleteAllRuns,
  deleteRun,
  getLatestResults,
  listRuns,
  readResultsByRunId,
} from '../services/resultsService.js';
import { isPipelineRunning, isRunningRunId } from '../services/dockerService.js';
import { ConflictError } from '../errors.js';

// ============================================================
// Роутер: /api/results
// ============================================================

const router = Router();

// ============================================================
// GET /api/results/runs — список всех запусков (история)
// ============================================================
//
// ВАЖНО: этот роут зарегистрирован ПЕРЕД `GET /:runId`.
// Express матчит роуты в порядке регистрации, и `/:runId` поймал бы
// `/runs` как параметр (runId="runs"). Конкретные пути всегда раньше
// параметризованных.
// ============================================================

router.get('/runs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const runs = await listRuns();
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/results — результаты последнего запуска
// ============================================================

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await getLatestResults();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DELETE /api/results — удалить всю историю запусков
// ============================================================
//
// 409 если пайплайн в running (нельзя сносить под ним папки).
// ============================================================

router.delete('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (isPipelineRunning()) {
      throw new ConflictError('Нельзя удалять запуски во время работы анализа');
    }
    await deleteAllRuns();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/results/:runId — результаты конкретного запуска
// ============================================================

router.get(
  '/:runId',
  async (req: Request<{ runId: string }>, res: Response, next: NextFunction) => {
    try {
      const results = await readResultsByRunId(req.params.runId);
      res.json(results);
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================
// DELETE /api/results/:runId — удалить конкретный запуск
// ============================================================
//
// 400 — невалидный runId; 409 — этот runId сейчас выполняется;
// 404 — папки нет; 204 — удалено.
// ============================================================

router.delete(
  '/:runId',
  async (req: Request<{ runId: string }>, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      if (isRunningRunId(runId)) {
        throw new ConflictError(`Запуск ${runId} сейчас выполняется, нельзя удалять`);
      }
      await deleteRun(runId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
