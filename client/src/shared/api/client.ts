import axios, { AxiosError } from 'axios';
import type {
  UploadStatusResponse,
  UploadedFileInfo,
  ReadsListEntry,
  ValidationResult,
  PipelineStatusResponse,
  HealthResponse,
  PipelineResults,
  RunInfo,
  ApiError,
} from '../model/types';

// ============================================================
// Axios-инстанс
// ============================================================

const api = axios.create();

// ============================================================
// Response interceptor: разворачиваем ошибку сервера
// ============================================================
//
// Сервер при ошибке возвращает JSON { error: "понятный текст" }
// (см. errorHandler.ts). По умолчанию axios теряет это сообщение:
// AxiosError.message = "Request failed with status code 500".
//
// Здесь мы один раз централизованно достаём error.response.data.error
// и подкладываем его как message в обычный Error. Дальше во всех
// catch-блоках бизнес-логики `err.message` — это уже человеко-читаемое
// сообщение от сервера, а не axios-дефолт.
//
// Если запрос отменён через AbortController — пробрасываем как есть,
// чтобы useFetch / другие места могли отличить отмену от настоящей ошибки.
// ============================================================
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    const serverMessage = error.response?.data?.error;
    if (serverMessage) {
      return Promise.reject(new Error(serverMessage));
    }
    return Promise.reject(error);
  },
);

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

// ============================================================
// Проверка Docker-окружения
// ============================================================

/**
 * Проверяет окружение: установлен ли Docker, загружен ли образ пайплайна.
 * Вызывается при старте приложения.
 */
export async function checkHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await api.get('/api/health', { signal });
  return response.data;
}

// ============================================================
// Управление пайплайном
// ============================================================

/**
 * Запускает анализ. Перед запуском сервер сам проверяет,
 * что все файлы загружены (list_reads.txt + FASTQ).
 *
 * Возвращает ID запуска (формат: 2024-01-15_143022).
 * Если пайплайн уже запущен — сервер вернёт 409.
 */
export async function runPipeline(): Promise<{ message: string; runId: string }> {
  const response = await api.post('/api/pipeline/run');
  return response.data;
}

/**
 * Получает текущий статус пайплайна.
 * Фронтенд вызывает каждые 2-3 секунды (polling) во время анализа.
 *
 * @param signal — AbortSignal для отмены запроса (см. useFetch)
 */
export async function getPipelineStatus(signal?: AbortSignal): Promise<PipelineStatusResponse> {
  const response = await api.get('/api/pipeline/status', { signal });
  return response.data;
}

// ============================================================
// Результаты пайплайна
// ============================================================

/**
 * Получает результаты последнего успешного запуска пайплайна.
 *
 * Возможные ошибки (axios выбросит исключение):
 * - 404 — ни одного запуска ещё не было, либо results.json не создан
 * - 500 — файл результатов повреждён / не прошёл валидацию схемы
 *
 * @param signal — AbortSignal для отмены запроса (см. useFetch)
 */
export async function getResults(signal?: AbortSignal): Promise<PipelineResults> {
  const response = await api.get('/api/results', { signal });
  return response.data;
}

/**
 * Получает список всех запусков пайплайна (история), новые сверху.
 * Включает упавшие запуски — у них `hasResults === false`.
 */
export async function getRuns(signal?: AbortSignal): Promise<RunInfo[]> {
  const response = await api.get('/api/results/runs', { signal });
  return response.data;
}

/**
 * Получает результаты конкретного запуска по runId.
 *
 * Возможные ошибки:
 * - 400 — невалидный формат runId
 * - 404 — папки запуска нет, либо results.json в ней нет
 * - 500 — файл повреждён / не прошёл валидацию схемы
 */
export async function getResultsByRunId(
  runId: string,
  signal?: AbortSignal,
): Promise<PipelineResults> {
  const response = await api.get(`/api/results/${encodeURIComponent(runId)}`, { signal });
  return response.data;
}

/**
 * Удаляет конкретный запуск из истории.
 *
 * Возможные ошибки:
 * - 400 — невалидный runId
 * - 404 — папки запуска нет
 * - 409 — этот runId сейчас выполняется
 */
export async function deleteRun(runId: string, signal?: AbortSignal): Promise<void> {
  await api.delete(`/api/results/${encodeURIComponent(runId)}`, { signal });
}

/**
 * Удаляет всю историю запусков.
 *
 * Возможные ошибки:
 * - 409 — пайплайн в данный момент работает
 */
export async function deleteAllRuns(signal?: AbortSignal): Promise<void> {
  await api.delete('/api/results', { signal });
}
