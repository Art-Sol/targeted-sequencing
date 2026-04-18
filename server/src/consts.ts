import os from 'node:os';
import path from 'node:path';

// ============================================================
// Константы приложения
// ============================================================

/** Максимальный размер одного загружаемого файла (2 GB) */
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

/** Максимальное количество файлов в одном запросе на загрузку */
export const MAX_FILES_PER_REQUEST = 100;

/** Порог предупреждения о свободном месте на диске (2 GB) */
export const DISK_WARNING_THRESHOLD = 2 * 1024 * 1024 * 1024;

// ============================================================
// Docker / Pipeline
// ============================================================

/** Имя и тег Docker-образа пайплайна */
export const DOCKER_IMAGE = 'targets-pipeline:0.1.0';

/** Корневая папка проекта (на 2 уровня выше server/src/) */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** Рабочая директория пайплайна */
export const WORKDIR = path.join(PROJECT_ROOT, 'pipeline-workdir');

/** Папка для входных FASTQ-файлов */
export const INPUT_DATA_DIR = path.join(WORKDIR, 'input_data');

/** Путь к файлу описания образцов */
export const READS_LIST_PATH = path.join(WORKDIR, 'list_reads.txt');

/** Папка для выходных данных (результаты каждого запуска) */
export const OUTPUT_DIR = path.join(WORKDIR, 'output');

/** Папка для логов пайплайна */
export const LOGS_DIR = path.join(WORKDIR, 'logs');

/** Количество потоков для пайплайна: все ядра CPU минус 1 (оставляем системе) */
export const PIPELINE_THREADS = Math.max(1, os.cpus().length - 1);
