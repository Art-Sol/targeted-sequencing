// ============================================================
// Типы данных пайплайна таргетного секвенирования
// ============================================================

export type {
  Determinant,
  InputMode,
  Sample,
  PipelineInfo,
  PipelineSummary,
  PipelineResults,
} from './schemas/pipelineResults';

// ============================================================
// Типы для API и UI (не связаны со схемой results.json)
// ============================================================

/** Статус пайплайна */
export type PipelineStatus = 'idle' | 'running' | 'done' | 'error';

/** Ответ GET /api/pipeline/status (статус Docker-контейнера: запущен/завершён/ошибка) */
export interface PipelineStatusResponse {
  status: PipelineStatus;
  runId?: string;
  exitCode?: number;
  error?: string;
  samplesProcessed?: number;
  totalSamples?: number;
}

/** Ответ GET /api/health (проверка Docker-окружения) */
export interface HealthResponse {
  status: 'ok' | 'error';
  docker: boolean;
  daemon: boolean;
  image: boolean;
  /** true когда сервер сейчас выполняет `docker load` из bundled tar. */
  imageLoading: boolean;
  /** Текст последней ошибки `docker load`. Auto-retry заблокирован пока поле есть. */
  imageLoadError?: string;
  message?: string;
}

/** Метрика для отображения в таблице */
export type MetricType = 'mapped_reads' | 'rpkm' | 'presence';

// ============================================================
// Типы для загрузки файлов
// ============================================================

/** Информация о загруженном файле */
export interface UploadedFileInfo {
  name: string;
  size: number; // размер в байтах
  path: string; // относительный путь внутри pipeline-workdir
}

/** Ответ GET /api/upload/status (список загруженных файлов и свободное место на диске) */
export interface UploadStatusResponse {
  readsList: UploadedFileInfo | null;
  fastqFiles: UploadedFileInfo[];
  diskFreeBytes: number;
  diskWarning: boolean; // true если свободно менее 1 GB
}

/** Одна строка из list_reads.txt (парсинг TSV) */
export interface ReadsListEntry {
  sampleId: string;
  mode: 'se' | 'pe';
  fastqPaths: string[]; // 1 путь для se, 2 для pe
}

/** Результат валидации list_reads.txt vs загруженные FASTQ */
export interface ValidationResult {
  valid: boolean;
  entries: ReadsListEntry[];
  missingFiles: string[]; // FASTQ, которые указаны в list_reads.txt, но не загружены
  errors: string[]; // ошибки парсинга (неверный формат строки и т.д.)
}

/** Стандартный формат ошибки API */
export interface ApiError {
  error: string;
  details?: string;
}

// ============================================================
// История запусков
// ============================================================

/** Один запуск пайплайна в истории. */
export interface RunInfo {
  /** ID запуска в формате YYYY-MM-DD_HHmmss (см. dockerService.formatRunId). */
  runId: string;
  /** true, если на диске есть results.json — запуск завершился успешно. */
  hasResults: boolean;
}
