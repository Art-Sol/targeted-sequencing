import { Router, Request, Response, NextFunction } from 'express';
import {
  getLatestResults,
  listRuns,
  readResultsByRunId,
} from '../services/resultsService.js';

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
// GET /api/results/:runId — результаты конкретного запуска
// ============================================================

router.get('/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await readResultsByRunId(req.params.runId);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
