import multer from 'multer';
import os from 'node:os';
import { MAX_FILE_SIZE } from '../consts.js';

// ============================================================
// Настройка multer — middleware для обработки multipart/form-data
// ============================================================

/**
 * multer — библиотека для обработки загрузки файлов в Express.
 *
 * Когда браузер отправляет файл, он использует формат multipart/form-data.
 * Express сам по себе не умеет его парсить — для этого нужен multer.
 *
 * diskStorage означает, что файлы сохраняются на диск (а не в оперативную память).
 * Это критично для больших FASTQ-файлов (до 2 GB) — если хранить их в памяти,
 * сервер быстро упадёт с ошибкой "out of memory".
 *
 * destination: os.tmpdir() — временная папка ОС (например, C:\Users\...\Temp на Windows).
 * Файлы сначала попадают сюда, а потом fileService перемещает их в нужное место.
 * Если загрузка прервётся — в рабочей папке не будет
 * "полузагруженных" файлов.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    // Добавляем timestamp + случайное число к имени, чтобы избежать коллизий
    // при одновременной загрузке файлов с одинаковыми именами
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});
