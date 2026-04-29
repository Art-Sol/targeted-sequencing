import fs from 'node:fs/promises';
import path from 'node:path';
import { PipelineResultsSchema, type PipelineResults } from 'shared/schemas/pipelineResults';
import { OUTPUT_DIR } from '../consts.js';
import { NotFoundError } from '../errors.js';

// ============================================================
// Чтение результатов пайплайна
// ============================================================

/**
 * Находит ID самого свежего запуска в pipeline-workdir/output/.
 *
 * run_id формируется в dockerService как YYYY-MM-DD_HHmmss
 * @throws NotFoundError если папка output/ пуста или отсутствует.
 */
async function getLatestRunId(): Promise<string> {
  let entries;
  try {
    // withFileTypes: true — возвращает массив Dirent-объектов,
    // у которых есть метод isDirectory(). Без этого пришлось бы
    // делать отдельный fs.stat() на каждый элемент.
    entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  } catch {
    // Папки output/ ещё не существует — значит пайплайн ни разу не запускался
    throw new NotFoundError('Результаты не найдены. Сначала запустите анализ.');
  }

  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (runIds.length === 0) {
    throw new NotFoundError('Результаты не найдены. Сначала запустите анализ.');
  }

  return runIds[runIds.length - 1];
}

/**
 * Читает и валидирует results.json последнего завершённого запуска.
 *
 * Возможные ошибки:
 * - 404 (NotFoundError): папка output/ пуста — пайплайн ни разу не запускался
 * - 404 (NotFoundError): папка запуска есть, но results.json в ней нет
 * - 500 (Error → errorHandler): results.json повреждён (невалидный JSON-синтаксис)
 * - 500 (Error → errorHandler): results.json распарсился, но структура не соответствует схеме
 */
export async function getLatestResults(): Promise<PipelineResults> {
  const runId = await getLatestRunId();
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

  // 2) Структурная валидация через Zod. Гарантирует, что все поля
  //    PipelineResults реально на месте и имеют правильные типы.
  const validated = PipelineResultsSchema.safeParse(rawData);
  if (!validated.success) {
    // ZodError.issues — массив проблем: { path: [...], message: '...' }.
    // path — путь к проблемному полю, например ['samples', 0, 'determinants', 2, 'rpkm'].
    const summary = validated.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Структура results.json не соответствует ожидаемой. ${summary}`);
  }

  return validated.data;
}
