import axios from 'axios';
import type {
  UploadStatusResponse,
  UploadedFileInfo,
  ReadsListEntry,
  ValidationResult,
} from '../model/types';

// ============================================================
// Axios-инстанс
// ============================================================

const api = axios.create();

// ============================================================
// Загрузка list_reads.txt
// ============================================================

/**
 * Загружает файл описания образцов (list_reads.txt) на сервер.
 *
 * @param file — файл, выбранный пользователем (объект File из браузера)
 * @param onProgress — колбэк для отображения прогресса (0-100%)
 * @returns массив распарсенных строк из list_reads.txt
 */
export async function uploadReadsList(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ReadsListEntry[]> {
  const form = new FormData();
  form.append('file', file);

  const response = await api.post('/api/upload/reads-list', form, {
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return response.data.entries;
}

// ============================================================
// Загрузка одного FASTQ-файла
// ============================================================

/**
 * Загружает один FASTQ-файл на сервер.
 *
 * timeout: 0 — отключаем таймаут axios.
 * По умолчанию axios отменяет запрос если ответ не пришёл за N секунд.
 * FASTQ-файлы до 2 GB могут загружаться минутами — таймаут нам помешает.
 */
export async function uploadSingleFastq(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFileInfo> {
  const form = new FormData();
  form.append('files', file);

  const response = await api.post('/api/upload/fastq', form, {
    timeout: 0,
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return response.data.files[0];
}

// ============================================================
// Статус загруженных файлов
// ============================================================

/**
 * Получает информацию обо всех загруженных файлах, свободном месте
 * на диске и результат валидации (все ли FASTQ на месте).
 *
 * Фронтенд вызывает эту функцию:
 * - При первой загрузке страницы (узнать текущее состояние)
 * - После каждой загрузки файла (обновить список)
 * - После очистки файлов
 */
export async function getUploadStatus(): Promise<
  UploadStatusResponse & { validation: ValidationResult }
> {
  const response = await api.get('/api/upload/status');
  return response.data;
}

// ============================================================
// Очистка загруженных файлов
// ============================================================

/**
 * Удаляет все загруженные файлы (list_reads.txt + FASTQ).
 * Используется перед новым анализом или для освобождения места.
 */
export async function cleanUploads(): Promise<void> {
  await api.delete('/api/upload/clean');
}
