// ============================================================
// Типы данных пайплайна таргетного секвенирования
// Основаны на реальном выходном JSON targets-pipeline:0.1.0
// ============================================================

/** Один детерминант (таргет) внутри образца */
export interface Determinant {
  determinant_id: string;
  reference_length: number;
  mapped_reads: number;
  rpkm: number;
}

/** Режим секвенирования: single-end или paired-end */
export type InputMode = 'se' | 'pe';

/** Результаты анализа одного образца */
export interface Sample {
  sample_id: string;
  total_mapped_reads: number;
  n_determinants: number;
  n_detected_determinants: number;
  determinants: Determinant[];
  input_mode: InputMode;
  input_fastq_files: string[];
  bam_file: string;
  bam_index: string;
  rpkm_table: string;
}

/** Метаданные запуска пайплайна */
export interface PipelineInfo {
  name: string;
  version: string;
  run_datetime_utc: string;
  threads: number;
}

/** Сводная статистика по всем образцам */
export interface PipelineSummary {
  n_samples: number;
  total_mapped_reads_across_samples: number;
  total_detected_determinants_across_samples: number;
}

/** Полный JSON-ответ пайплайна (results.json) */
export interface PipelineResults {
  pipeline: PipelineInfo;
  summary: PipelineSummary;
  samples: Sample[];
}

// ============================================================
// Типы для API и UI
// ============================================================

/** Статус пайплайна */
export type PipelineStatus = 'idle' | 'running' | 'done' | 'error';

/** Ответ GET /api/pipeline/status (статус Docker-контейнера: запущен/завершён/ошибка) */
export interface PipelineStatusResponse {
  status: PipelineStatus;
  runId?: string;
  exitCode?: number;
  error?: string;
}

/** Ответ GET /api/health (проверка Docker-окружения) */
export interface HealthResponse {
  status: 'ok' | 'error';
  docker: boolean;
  daemon: boolean;
  image: boolean;
  message?: string;
}

/** Метрика для отображения в таблице */
export type MetricType = 'mapped_reads' | 'rpkm';

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
  mode: InputMode; // 'se' или 'pe'
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
