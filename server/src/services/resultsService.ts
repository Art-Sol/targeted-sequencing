import fs from 'node:fs/promises';
import path from 'node:path';
import { PipelineResultsSchema, type PipelineResults } from 'shared/schemas/pipelineResults';
import type { RunInfo } from 'shared/types';
import { OUTPUT_DIR } from '../consts.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// ============================================================
// Чтение результатов пайплайна и истории запусков
// ============================================================

/**
 * Регекс «валидный runId» (YYYY-MM-DD_HHmmss).
 *
 * Зачем строго: runId приходит из URL (`GET /api/results/:runId`), и мы
 * подставляем его в путь к файлу. Без проверки злоумышленник мог бы
 * передать `../../etc/passwd` и прочитать произвольный файл сервера
 * (path traversal). Регекс гарантирует, что внутри только цифры
 * и единственный «-»/«_» в фиксированных позициях.
 */
const RUN_ID_REGEX = /^\d{4}-\d{2}-\d{2}_\d{6}$/;

// ============================================================
// Внутренние помощники
// ============================================================

/**
 * Возвращает отсортированный по возрастанию список валидных runId-папок
 * в `pipeline-workdir/output/`.
 *
 * Невалидные имена и не-папки фильтруются — это защищает от мусора,
 * случайно положенного руками (.DS_Store на macOS, временные файлы и т.п.).
 */
async function listRunIds(): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  } catch {
    // Папки output/ ещё не существует — значит запусков не было.
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory() && RUN_ID_REGEX.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Проверяет существование файла без бросания ошибки. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Метаданные запуска, лежат в `output/<runId>/metadata.json`. */
interface RunMetadata {
  name: string;
  createdAt: string;
}

/**
 * Читает metadata.json для runId. Возвращает null если файла нет или
 * содержимое не соответствует ожидаемой форме (битый JSON, нет name).
 * Папки без валидных метаданных в `listRuns` не попадают — это инвариант
 * системы: их пишет dockerService до spawn'а контейнера.
 */
async function readRunMetadata(runId: string): Promise<RunMetadata | null> {
  const metadataPath = path.join(OUTPUT_DIR, runId, 'metadata.json');
  let content: string;
  try {
    content = await fs.readFile(metadataPath, 'utf-8');
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      typeof (parsed as { name: unknown }).name === 'string' &&
      'createdAt' in parsed &&
      typeof (parsed as { createdAt: unknown }).createdAt === 'string'
    ) {
      return parsed as RunMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Публичные функции
// ============================================================

/**
 * Возвращает список всех запусков в порядке «самый свежий первым».
 * Включает и упавшие запуски — у них `hasResults === false`. Решение
 * «показывать ли упавшие в UI» — на стороне клиента.
 *
 * Папки без валидного `metadata.json` отфильтровываются: metadata —
 * инвариант системы, его пишет dockerService до spawn'а контейнера.
 * Если файла нет — папка либо создана вручную, либо данные битые,
 * показывать такое в истории нечем (нет имени).
 */
export async function listRuns(): Promise<RunInfo[]> {
  const ids = await listRunIds();
  // ids отсортирован по возрастанию (старый → свежий). Нам в UI удобнее
  // обратный порядок.
  const reversed = [...ids].reverse();

  const runs = await Promise.all(
    reversed.map(async (runId) => {
      const metadata = await readRunMetadata(runId);
      if (!metadata) return null;
      return {
        runId,
        name: metadata.name,
        hasResults: await fileExists(path.join(OUTPUT_DIR, runId, 'results.json')),
      };
    }),
  );

  return runs.filter((run): run is RunInfo => run !== null);
}

/**
 * Пишет metadata.json в папку запуска. Зовётся из dockerService
 * сразу после `mkdir output/<runId>/`, до spawn'а контейнера — чтобы
 * даже упавшие запуски попадали в историю с именем.
 *
 * Папка `output/<runId>/` должна существовать (создаётся в dockerService).
 */
export async function saveRunMetadata(runId: string, name: string): Promise<void> {
  const metadataPath = path.join(OUTPUT_DIR, runId, 'metadata.json');
  const metadata: RunMetadata = {
    name,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Читает и валидирует results.json для конкретного runId.
 *
 * Возможные ошибки:
 * - 400 (BadRequestError): runId не соответствует формату YYYY-MM-DD_HHmmss
 * - 404 (NotFoundError): папки запуска нет, либо results.json в ней нет
 * - 500 (Error → errorHandler): JSON повреждён или не соответствует схеме
 */
export async function readResultsByRunId(runId: string): Promise<PipelineResults> {
  if (!RUN_ID_REGEX.test(runId)) {
    throw new BadRequestError(`Невалидный runId: "${runId}".`);
  }

  const resultsPath = path.join(OUTPUT_DIR, runId, 'results.json');

  let content: string;
  try {
    content = await fs.readFile(resultsPath, 'utf-8');
  } catch {
    throw new NotFoundError(`Файл результатов для запуска ${runId} не найден.`);
  }

  // 1) Синтаксический разбор JSON. Если файл обрезан или повреждён
  //    (редко, но бывает после аварийного завершения пайплайна) —
  //    JSON.parse бросает SyntaxError с невнятным "Unexpected token".
  //    Перехватываем и формулируем понятное сообщение.
  let rawData: unknown;
  try {
    rawData = JSON.parse(content);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`results.json повреждён (невалидный JSON): ${detail}`);
  }

  // 2) Структурная валидация через Zod.
  const validated = PipelineResultsSchema.safeParse(rawData);
  if (!validated.success) {
    const summary = validated.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Структура results.json не соответствует ожидаемой. ${summary}`);
  }

  return validated.data;
}

/**
 * Возвращает results.json самого свежего запуска.
 *
 * @throws NotFoundError если запусков нет вообще
 *         (для упавшего последнего запуска бросает «файл не найден» —
 *          это симптом, что пайплайн крэшнулся; поверх этого фронт
 *          отдельно показывает state.error из dockerService).
 */
export async function getLatestResults(): Promise<PipelineResults> {
  const ids = await listRunIds();
  if (ids.length === 0) {
    throw new NotFoundError('Результаты не найдены. Сначала запустите анализ.');
  }
  return readResultsByRunId(ids[ids.length - 1]);
}

/**
 * Удаляет папку конкретного запуска целиком.
 *
 * Возможные ошибки:
 * - 400 (BadRequestError): runId не соответствует формату
 * - 404 (NotFoundError): папки запуска нет
 *
 * Ответственность за «нельзя удалять running-запуск» лежит на роуте —
 * сервис не знает про docker-state и пайплайны.
 */
export async function deleteRun(runId: string): Promise<void> {
  if (!RUN_ID_REGEX.test(runId)) {
    throw new BadRequestError(`Невалидный runId: "${runId}".`);
  }

  const runPath = path.join(OUTPUT_DIR, runId);
  try {
    await fs.access(runPath);
  } catch {
    throw new NotFoundError(`Запуск ${runId} не найден.`);
  }

  // recursive: true — рекурсивно сносит подпапки и файлы.
  // force: true — не падает на разовых ENOENT (защита от гонок при
  // параллельных DELETE-запросах: два клиента одновременно могут
  // нажать удаление, второй увидит пустоту и не должен ронять с EEXIST).
  await fs.rm(runPath, { recursive: true, force: true });
}

/**
 * Удаляет все runId-папки из output/. Папки и файлы, которые не
 * соответствуют RUN_ID_REGEX, не трогает — это защита от случайного
 * сноса вручную положенных бэкапов или служебных директорий.
 *
 * Если output/ ещё не существует — no-op (нечего удалять).
 *
 * Ответственность за «нельзя удалять во время running» — на роуте.
 */
export async function deleteAllRuns(): Promise<void> {
  const ids = await listRunIds();
  await Promise.all(
    ids.map((runId) => fs.rm(path.join(OUTPUT_DIR, runId), { recursive: true, force: true })),
  );
}
