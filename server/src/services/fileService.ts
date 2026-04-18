import fs from 'fs/promises';
import path from 'path';
import type {
  UploadedFileInfo,
  UploadStatusResponse,
  ReadsListEntry,
  ValidationResult,
} from '../types/index.js';
import { DISK_WARNING_THRESHOLD } from '../consts.js';

// ============================================================
// Константы — пути к рабочим директориям
// ============================================================

// __dirname указывает на server/src/services/, поднимаемся на 3 уровня до корня проекта
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKDIR = path.join(PROJECT_ROOT, 'pipeline-workdir');
const INPUT_DATA_DIR = path.join(WORKDIR, 'input_data');
const READS_LIST_PATH = path.join(WORKDIR, 'list_reads.txt');

// Допустимые расширения FASTQ-файлов
const VALID_FASTQ_EXTENSIONS = ['.fastq.gz', '.fq.gz', '.fastq', '.fq'];

// ============================================================
// Работа с директориями
// ============================================================

/**
 * Создаёт рабочие директории, если их ещё нет.
 * { recursive: true } означает: если папка уже существует — не падать с ошибкой,
 * а если нет промежуточных папок — создать их тоже (как mkdir -p в Linux).
 */
export async function ensureDirectories(): Promise<void> {
  await fs.mkdir(INPUT_DATA_DIR, { recursive: true });
}

// ============================================================
// Перемещение файлов (с fallback для кроссплатформенности)
// ============================================================

/**
 * Перемещает файл из source в destination.
 *
 * Почему не просто fs.rename()?
 * fs.rename() работает только в пределах одной файловой системы (одного раздела диска).
 * Если temp-директория ОС и рабочая папка проекта на разных дисках (например, C: и D:
 * на Windows), rename выбросит ошибку EXDEV ("cross-device link not permitted").
 *
 * Поэтому: сначала пробуем rename (быстро, без копирования), а если EXDEV —
 * копируем файл + удаляем оригинал.
 */
async function moveFile(source: string, destination: string): Promise<void> {
  try {
    await fs.rename(source, destination);
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(source, destination);
      await fs.unlink(source);
    } else {
      throw err;
    }
  }
}

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * Проверяет, имеет ли файл допустимое FASTQ-расширение.
 *
 * Важный нюанс: нужно проверять двойные расширения (.fastq.gz) РАНЬШЕ,
 * чем одинарные (.fastq). Иначе файл "reads.fastq.gz" пройдёт проверку
 * на ".gz" (если бы мы её делали) и не дойдёт до ".fastq.gz".
 * Массив VALID_FASTQ_EXTENSIONS отсортирован: сначала двойные, потом одинарные.
 */
export function isFastqExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return VALID_FASTQ_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Проверяет существование файла.
 * fs.access проверяет, доступен ли файл. Если нет — выбрасывает ошибку,
 * которую мы ловим и возвращаем false.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Сохранение загруженных файлов
// ============================================================

/**
 * Сохраняет list_reads.txt — файл-описание образцов.
 * @param tempPath — путь к временному файлу, куда multer сохранил загрузку
 */
export async function saveReadsList(tempPath: string): Promise<void> {
  await ensureDirectories();
  await moveFile(tempPath, READS_LIST_PATH);
}

/**
 * Сохраняет один FASTQ-файл в input_data/.
 * @param tempPath — путь к временному файлу от multer
 * @param originalName — оригинальное имя файла от пользователя
 */
export async function saveFastqFile(tempPath: string, originalName: string): Promise<void> {
  if (!isFastqExtension(originalName)) {
    // Удаляем temp-файл, чтобы не засорять диск
    await fs.unlink(tempPath).catch(() => {});
    throw new Error(
      `Недопустимое расширение файла: "${originalName}". ` +
        `Допустимые: ${VALID_FASTQ_EXTENSIONS.join(', ')}`,
    );
  }

  await ensureDirectories();
  const destPath = path.join(INPUT_DATA_DIR, originalName);
  await moveFile(tempPath, destPath);
}

// ============================================================
// Парсинг list_reads.txt
// ============================================================

/**
 * Читает и парсит list_reads.txt (TSV-формат).
 *
 * Формат файла (разделитель — табуляция):
 *   sample1    se    input_data/test_se.fastq
 *   sample2    pe    input_data/test_pe_R1.fastq    input_data/test_pe_R2.fastq
 *
 * Каждая строка описывает один образец:
 * - Колонка 1: sample_id (имя образца)
 * - Колонка 2: тип — "se" (single-end, 1 файл) или "pe" (paired-end, 2 файла)
 * - Колонки 3+: пути к FASTQ-файлам
 *
 * @returns массив распарсенных строк
 * @throws Error если файл не существует или имеет ошибки формата
 */
export async function parseReadsList(): Promise<ReadsListEntry[]> {
  let content: string;
  try {
    content = await fs.readFile(READS_LIST_PATH, 'utf-8');
  } catch {
    throw new Error('Файл list_reads.txt не найден. Сначала загрузите его.');
  }

  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0); // пропускаем пустые строки

  if (lines.length === 0) {
    throw new Error('Файл list_reads.txt пуст.');
  }

  const entries: ReadsListEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const fields = lines[i].split('\t');

    // Минимум 3 поля: sample_id, type, fastq_path
    if (fields.length < 3) {
      errors.push(
        `Строка ${lineNum}: ожидается минимум 3 поля (через табуляцию), получено ${fields.length}`,
      );
      continue;
    }

    const sampleId = fields[0];
    const mode = fields[1];

    // Проверяем, что тип — se или pe
    if (mode !== 'se' && mode !== 'pe') {
      errors.push(`Строка ${lineNum}: тип должен быть "se" или "pe", получено "${mode}"`);
      continue;
    }

    // se = 3 поля (1 FASTQ), pe = 4 поля (2 FASTQ)
    const expectedFields = mode === 'se' ? 3 : 4;
    if (fields.length !== expectedFields) {
      errors.push(
        `Строка ${lineNum}: для типа "${mode}" ожидается ${expectedFields} поля, получено ${fields.length}`,
      );
      continue;
    }

    const fastqPaths = fields.slice(2); // все поля после sample_id и mode

    entries.push({ sampleId, mode, fastqPaths });
  }

  if (errors.length > 0) {
    throw new Error(`Ошибки в list_reads.txt:\n${errors.join('\n')}`);
  }

  return entries;
}

// ============================================================
// Валидация: сопоставление list_reads.txt с загруженными файлами
// ============================================================

/**
 * Проверяет, все ли FASTQ-файлы, указанные в list_reads.txt,
 * реально загружены в input_data/.
 *
 * Пути в list_reads.txt выглядят как "input_data/test_se.fastq" —
 * это пути для Docker-контейнера, а не для хоста.
 * Поэтому мы извлекаем только имя файла (basename) и проверяем его наличие.
 */
export async function validateUploadedFiles(): Promise<ValidationResult> {
  // Если list_reads.txt нет — нечего валидировать
  const exists = await fileExists(READS_LIST_PATH);
  if (!exists) {
    return { valid: false, entries: [], missingFiles: [], errors: ['list_reads.txt не загружен'] };
  }

  let entries: ReadsListEntry[];
  try {
    entries = await parseReadsList();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, entries: [], missingFiles: [], errors: [message] };
  }

  // Получаем список файлов в input_data/
  let uploadedFiles: string[] = [];
  try {
    uploadedFiles = await fs.readdir(INPUT_DATA_DIR);
  } catch {
    // Папка не существует — все файлы "отсутствуют"
    // uploadedFiles остается как пустой массив []
  }

  // Собираем все FASTQ-имена из list_reads.txt
  const requiredFiles = entries.flatMap((entry) => entry.fastqPaths.map((p) => path.basename(p)));

  // Проверяем, какие файлы не найдены
  const missingFiles = requiredFiles.filter((name) => !uploadedFiles.includes(name));

  return {
    valid: missingFiles.length === 0,
    entries,
    missingFiles,
    errors: [],
  };
}

// ============================================================
// Статус загруженных файлов
// ============================================================

/**
 * Возвращает информацию обо всех загруженных файлах и свободном месте на диске.
 * Используется для GET /api/upload/status.
 */
export async function getUploadStatus(): Promise<UploadStatusResponse> {
  // Проверяем list_reads.txt
  let readsList: UploadedFileInfo | null = null;
  try {
    const stat = await fs.stat(READS_LIST_PATH);
    readsList = {
      name: 'list_reads.txt',
      size: stat.size,
      path: 'list_reads.txt',
    };
  } catch {
    // Файл не существует — readsList остаётся null
  }

  // Получаем список FASTQ-файлов в input_data/
  const fastqFiles: UploadedFileInfo[] = [];
  try {
    const files = await fs.readdir(INPUT_DATA_DIR);
    for (const name of files) {
      const filePath = path.join(INPUT_DATA_DIR, name);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        fastqFiles.push({
          name,
          size: stat.size,
          path: `input_data/${name}`,
        });
      }
    }
  } catch {
    // Папка не существует — пустой массив
  }

  // Проверяем свободное место на диске
  let diskFreeBytes = -1;
  let diskWarning = false;
  try {
    const stats = await fs.statfs(WORKDIR);
    // bavail — количество свободных блоков для непривилегированных пользователей
    // bsize — размер одного блока в байтах
    diskFreeBytes = stats.bavail * stats.bsize;
    diskWarning = diskFreeBytes < DISK_WARNING_THRESHOLD;
  } catch {
    // fs.statfs может не поддерживаться — не критично
  }

  return { readsList, fastqFiles, diskFreeBytes, diskWarning };
}

// ============================================================
// Очистка загруженных файлов
// ============================================================

/**
 * Удаляет все загруженные файлы: list_reads.txt и содержимое input_data/.
 * Сами директории не удаляет — только файлы внутри.
 */
export async function cleanInputData(): Promise<void> {
  // Удаляем list_reads.txt
  await fs.unlink(READS_LIST_PATH).catch(() => {});

  // Удаляем все файлы в input_data/
  try {
    const files = await fs.readdir(INPUT_DATA_DIR);
    await Promise.all(files.map((name) => fs.unlink(path.join(INPUT_DATA_DIR, name))));
  } catch {
    // Папка не существует — ничего делать не нужно
  }
}
