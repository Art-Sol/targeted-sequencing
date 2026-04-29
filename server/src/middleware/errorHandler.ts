import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { HttpError } from '../errors.js';

/**
 * Централизованный обработчик ошибок Express.
 *
 * Express различает обычные middleware (3 аргумента: req, res, next)
 * и error-handling middleware (4 аргумента: err, req, res, next).
 * Когда где-то в коде вызывается next(error) или выбрасывается исключение,
 * Express пропускает все обычные middleware и попадает сюда.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Логируем ошибку на сервере для диагностики
  console.error(`[${new Date().toISOString()}] Error:`, err.message);

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Обработка ошибок multer (загрузка файлов)
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          error: 'Файл слишком большой (максимум 2 GB)',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: `Неожиданное имя поля: "${err.field}"`,
        });
        return;
      default:
        res.status(400).json({
          error: `Ошибка загрузки: ${err.message}`,
        });
        return;
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';

  // Все остальные ошибки — 500
  res.status(500).json({
    error: err.message || 'Внутренняя ошибка сервера',
    ...(isDev && { details: err.stack }),
  });
}
