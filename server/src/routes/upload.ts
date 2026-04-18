import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { upload } from '../middleware/upload.js';
import { MAX_FILES_PER_REQUEST } from '../consts.js';
import {
  saveReadsList,
  saveFastqFile,
  parseReadsList,
  getUploadStatus,
  validateUploadedFiles,
  cleanInputData,
} from '../services/fileService.js';

// ============================================================
// Роутер
// ============================================================

/**
 * Router — способ группировки связанных эндпоинтов в Express.
 * router.post('/reads-list') → полный путь будет /api/upload/reads-list
 */
const router = Router();

// ============================================================
// POST /api/upload/reads-list — загрузка файла описания образцов
// ============================================================

/**
 * upload.single('file') — multer middleware, который:
 * 1. Извлекает один файл из поля формы с именем 'file'
 * 2. Сохраняет его на диск (в os.tmpdir())
 * 3. Записывает информацию о файле в req.file
 *
 * После multer файл уже на диске — мы вызываем saveReadsList,
 * чтобы переместить его в pipeline-workdir/list_reads.txt,
 * а затем parseReadsList, чтобы распарсить и вернуть содержимое клиенту.
 */
router.post(
  '/reads-list',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Файл не выбран' });
        return;
      }

      await saveReadsList(req.file.path);
      const entries = await parseReadsList();

      res.json({
        message: 'list_reads.txt загружен',
        entries,
      });
    } catch (err) {
      // Удаляем temp-файл, если что-то пошло не так
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(err); // передаём ошибку в errorHandler
    }
  },
);

// ============================================================
// POST /api/upload/fastq — загрузка FASTQ-файлов
// ============================================================

/**
 * upload.array('files', MAX_FILES_PER_REQUEST) — multer middleware для множественной загрузки:
 * - 'files' — имя поля формы (фронтенд должен использовать то же имя)
 * - 100 — максимальное количество файлов за один запрос
 *
 * req.files будет массивом объектов с информацией о каждом файле.
 *
 * Фронтенд отправляет файлы по одному (каждый через отдельный запрос),
 * но бэкенд поддерживает и пакетную загрузку — upload.array работает
 * и с одним файлом, и с несколькими.
 */
router.post(
  '/fastq',
  upload.array('files', MAX_FILES_PER_REQUEST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Файлы не выбраны' });
        return;
      }

      const saved = [];

      for (const file of files) {
        await saveFastqFile(file.path, file.originalname);
        saved.push({
          name: file.originalname,
          size: file.size,
          path: `input_data/${file.originalname}`,
        });
      }

      res.json({
        message: `Загружено файлов: ${saved.length}`,
        files: saved,
      });
    } catch (err) {
      // Удаляем все temp-файлы при ошибке
      const files = req.files as Express.Multer.File[] | undefined;
      if (files) {
        await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
      }
      next(err);
    }
  },
);

// ============================================================
// GET /api/upload/status — статус загруженных файлов
// ============================================================

/**
 * Возвращает клиенту полную картину:
 * - Какие файлы загружены (list_reads.txt + FASTQ)
 * - Сколько свободного места на диске
 * - Результат валидации (все ли FASTQ на месте)
 *
 * Фронтенд вызывает этот эндпоинт после каждой загрузки и при первой загрузке страницы.
 */
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getUploadStatus();
    const validation = await validateUploadedFiles();

    res.json({ ...status, validation });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DELETE /api/upload/clean — очистка загруженных файлов
// ============================================================

/**
 * Удаляет все загруженные файлы (list_reads.txt + содержимое input_data/).
 * Используется перед новым анализом или для освобождения места на диске.
 */
router.delete('/clean', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await cleanInputData();
    res.json({ message: 'Загруженные файлы удалены' });
  } catch (err) {
    next(err);
  }
});

export default router;
