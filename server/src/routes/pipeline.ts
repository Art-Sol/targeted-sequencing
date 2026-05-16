import { Router, Request, Response, NextFunction } from 'express';
import { runPipeline, getPipelineStatus } from '../services/dockerService.js';
import { validateUploadedFiles } from '../services/fileService.js';
import { BadRequestError } from '../errors.js';

// ============================================================
// Роутер
// ============================================================

const router = Router();

// ============================================================
// Валидация имени анализа
// ============================================================
//
// Дублируется на клиенте (RunNameModal) — defence-in-depth: фронт даёт
// мгновенный UX-фидбек, сервер защищает от обхода (curl, кривой клиент).
// Расширять класс символов — только синхронно с клиентом.
// ============================================================

const VALID_NAME_REGEX = /^[\p{L}\p{N} _]+$/u;
const MAX_NAME_LENGTH = 100;

function validateRunName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new BadRequestError('Имя анализа обязательно');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError('Имя анализа не может быть пустым');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Имя анализа не может быть длиннее ${MAX_NAME_LENGTH} символов`);
  }
  if (!VALID_NAME_REGEX.test(trimmed)) {
    throw new BadRequestError(
      'Имя содержит недопустимые символы. Разрешены буквы, цифры, пробелы и нижнее подчёркивание.',
    );
  }
  return trimmed;
}

// ============================================================
// POST /api/pipeline/run — запуск анализа
// ============================================================

router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Валидация имени анализа
    const name = validateRunName(req.body?.name);

    // 2. Валидация: все ли файлы загружены?
    const validation = await validateUploadedFiles();

    if (!validation.valid) {
      res.status(400).json({
        error: 'Не все файлы загружены',
        missingFiles: validation.missingFiles,
        errors: validation.errors,
      });
      return;
    }

    // 3. Запуск пайплайна
    const { runId } = await runPipeline(name);

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
