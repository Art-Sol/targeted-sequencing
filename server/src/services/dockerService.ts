import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PipelineStatus } from 'shared/types';
import {
  DOCKER_IMAGE,
  INPUT_DATA_DIR,
  READS_LIST_PATH,
  OUTPUT_DIR,
  LOGS_DIR,
  PIPELINE_THREADS,
  STAGING_DIR,
} from '../consts';
import { ConflictError } from '../errors';
import { parseReadsList } from './fileService';

// ============================================================
// Состояние пайплайна (singleton — живёт в памяти сервера)
// ============================================================

interface PipelineState {
  status: PipelineStatus;
  runId: string | null;
  containerId: string | null;
  exitCode: number | null;
  error: string | null;
  stderrTail: string[];
  totalSamples: number | null;
  samplesProcessed: number;
}

const state: PipelineState = {
  status: 'idle',
  runId: null,
  containerId: null,
  exitCode: null,
  error: null,
  stderrTail: [],
  totalSamples: null,
  samplesProcessed: 0,
};

// bwa пишет эту строку в stderr ОДИН РАЗ на каждый образец, в начале его
// обработки. Считая вхождения, знаем какой образец сейчас идёт.
const SAMPLE_START_MARKER = '[M::bwa_idx_load_from_disk]';

// ============================================================
// Публичные функции
// ============================================================

/** Получить текущий статус пайплайна */
export function getPipelineStatus() {
  return {
    status: state.status,
    runId: state.runId ?? undefined,
    exitCode: state.exitCode ?? undefined,
    error: state.error ?? undefined,
    totalSamples: state.totalSamples ?? undefined,
    samplesProcessed: state.samplesProcessed,
  };
}

/**
 * Сбрасывает state в initial ('idle').
 *
 * Вызывается при очистке загруженных файлов — логика «начать с чистого листа».
 * Бросает ConflictError если пайплайн в процессе работы: пока идёт анализ,
 * трогать ни файлы, ни state нельзя.
 */
export function resetPipelineState(): void {
  if (state.status === 'running') {
    throw new ConflictError('Нельзя очистить файлы во время работы анализа');
  }
  state.status = 'idle';
  state.runId = null;
  state.containerId = null;
  state.exitCode = null;
  state.error = null;
  state.stderrTail = [];
  state.totalSamples = null;
  state.samplesProcessed = 0;
}

/**
 * Запустить пайплайн.
 *
 * Синхронно ставит state.status='running' и возвращает runId — поэтому
 * клиент через polling /api/pipeline/status сразу увидит «running»,
 * не дожидаясь физической подготовки (создания директорий, staging,
 * spawn'а Docker).
 *
 * Тяжёлая работа (hardlink'и FASTQ, запуск контейнера) идёт в фоне
 * через runPipelineBackground. Её ошибки ловятся в .catch() и
 * переводят state в 'error' — клиент увидит это на следующем poll.
 */
export async function runPipeline(): Promise<{ runId: string }> {
  if (state.status === 'running') {
    throw new ConflictError('Пайплайн уже запущен');
  }

  const runId = formatRunId(new Date());

  // Сбрасываем state в running СРАЗУ
  state.status = 'running';
  state.runId = runId;
  state.containerId = `pipeline-${runId}`;
  state.exitCode = null;
  state.error = null;
  state.stderrTail = [];
  state.totalSamples = null;
  state.samplesProcessed = 0;

  // Fire-and-forget: длительная подготовка + spawn в фоне.
  // .catch() ОБЯЗАТЕЛЕН — без него unhandled rejection кладёт процесс Node.js.
  runPipelineBackground(runId).catch((err: unknown) => {
    console.error('[dockerService] Pipeline setup failed:', err);
    state.status = 'error';
    state.containerId = null;
    state.error = err instanceof Error ? err.message : String(err);
    // На всякий случай зачищаем staging, если он успел создаться
    fs.rm(path.join(STAGING_DIR, runId), { recursive: true, force: true }).catch(() => {});
  });

  return { runId };
}

/**
 * Фоновая подготовка и запуск контейнера.
 *
 * Здесь живёт вся длительная работа (staging + spawn + ручное управление
 * lifecycle контейнера). Вынесена отдельно, чтобы HTTP-роут мог вернуться
 * клиенту мгновенно, а эта функция отработала параллельно.
 *
 * Любая ошибка до spawn (mkdir, staging) бросается наверх и обрабатывается
 * catch'ем в runPipeline. Ошибки после spawn обрабатываются handlers'ами
 * child.on('close') / child.on('error') — state переводится в 'error' там.
 */
async function runPipelineBackground(runId: string): Promise<void> {
  const runOutputDir = path.join(OUTPUT_DIR, runId);
  const stagingDir = path.join(STAGING_DIR, runId);
  const logPath = path.join(LOGS_DIR, `pipeline_${runId}.log`);
  const resultsPathInContainer = '/app/output/results.json';

  // Создаём все нужные директории (recursive: true = не падать если уже есть)
  await fs.mkdir(runOutputDir, { recursive: true });
  await fs.mkdir(stagingDir, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });

  // Staging: hardlink'и всех FASTQ в stagingDir. Оригиналы в INPUT_DATA_DIR
  // не тронутся, пайплайн удалит только свои hardlink'и.
  await prepareStaging(stagingDir);

  // Для прогресс-бара: знаем сколько образцов всего в list_reads.txt.
  // try/catch — если вдруг парсинг упал, просто не будет totalSamples,
  // клиент покажет индетерминированный индикатор вместо процента.
  try {
    const entries = await parseReadsList();
    state.totalSamples = entries.length;
  } catch {
    state.totalSamples = null;
  }

  // Аргументы docker run (точечные монтирования, без -w /work)
  const args = [
    'run',
    '--rm',
    '--name',
    `pipeline-${runId}`,
    '-v',
    `${READS_LIST_PATH}:/app/list_reads.txt:ro`,
    '-v',
    `${stagingDir}:/app/input_data`,
    '-v',
    `${runOutputDir}:/app/output`,
    DOCKER_IMAGE,
    '--reads-list',
    '/app/list_reads.txt',
    '--output',
    resultsPathInContainer,
    '--threads',
    String(PIPELINE_THREADS),
  ];

  const child = spawn('docker', args);
  const logStream = await fs.open(logPath, 'w');

  child.stdout.on('data', (data: Buffer) => {
    const line = `[stdout] ${new Date().toISOString()} ${data.toString()}`;
    logStream.write(line);
  });

  child.stderr.on('data', (data: Buffer) => {
    const text = data.toString();
    const line = `[stderr] ${new Date().toISOString()} ${text}`;
    logStream.write(line);

    const lines = text.split('\n').filter((l) => l.trim());
    state.stderrTail.push(...lines);
    if (state.stderrTail.length > 50) {
      state.stderrTail = state.stderrTail.slice(-50);
    }

    // Прогресс: bwa печатает SAMPLE_START_MARKER один раз на каждый образец.
    // Считаем вхождения в этом чанке (он может содержать несколько строк).
    // split(marker).length - 1 — это число splits, т.е. количество вхождений.
    const markerCount = text.split(SAMPLE_START_MARKER).length - 1;
    if (markerCount > 0) {
      state.samplesProcessed += markerCount;
    }
  });

  child.on('close', (code) => {
    logStream.close();

    state.exitCode = code;
    state.containerId = null;

    if (code === 0) {
      state.status = 'done';
    } else {
      state.status = 'error';
      if (code === 137) {
        state.error =
          'Недостаточно оперативной памяти для анализа. ' +
          'Попробуйте закрыть другие программы и запустить анализ повторно.';
      } else {
        state.error =
          state.stderrTail.length > 0
            ? state.stderrTail.join('\n')
            : `Пайплайн завершился с кодом ${code}`;
      }
    }

    fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  });

  // Ошибка запуска самого процесса Docker (например, бинарник не найден)
  child.on('error', (err) => {
    logStream.close();

    state.status = 'error';
    state.containerId = null;

    if ('code' in err && err.code === 'ENOENT') {
      state.error = 'Docker не найден. Убедитесь, что Docker установлен и запущен.';
    } else {
      state.error = err.message;
    }

    fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  });
}

/**
 * Создаёт в stagingDir hardlink'и на все файлы из INPUT_DATA_DIR.
 *
 * Hardlink — это альтернативная directory entry для той же inode.
 * ОС считает "staging/<runId>/foo.fastq" и "input_data/foo.fastq"
 * одним и тем же файлом с двумя именами; физического копирования нет.
 *
 * Fallback на copyFile — для редких случаев, когда hardlink не работает
 * (антивирус на Windows, экзотическая FS). Медленнее, занимает место,
 * но гарантированно работает.
 */
async function prepareStaging(stagingDir: string): Promise<void> {
  const files = await fs.readdir(INPUT_DATA_DIR);
  await Promise.all(
    files.map(async (name) => {
      const src = path.join(INPUT_DATA_DIR, name);
      const dst = path.join(stagingDir, name);
      try {
        await fs.link(src, dst);
      } catch {
        // Fallback — физическое копирование
        await fs.copyFile(src, dst);
      }
    }),
  );
}

/**
 * Удаляет осиротевшие staging-папки от упавших/прерванных запусков.
 *
 * Вызывается при старте сервера. Пропускает папку, соответствующую
 * активному runId (если есть восстановленный контейнер из recoverState) —
 * её трогать нельзя, пайплайн с ней сейчас работает.
 */
export async function cleanupStaging(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(STAGING_DIR);
  } catch {
    // Папки нет — нечего чистить
    return;
  }

  const activeRunId = state.runId;
  for (const name of entries) {
    if (name === activeRunId) continue;
    await fs.rm(path.join(STAGING_DIR, name), { recursive: true, force: true }).catch(() => {});
  }
}

// ============================================================
// Проверка Docker-окружения
// ============================================================

/** Проверить установлен ли Docker CLI */
export function checkDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('docker', ['--version'], (err) => {
      resolve(!err);
    });
  });
}

/** Проверить запущен ли Docker daemon (движок) */
export function checkDaemon(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('docker', ['info'], (err) => {
      resolve(!err);
    });
  });
}

/** Проверить загружен ли Docker-образ пайплайна */
export function checkImage(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('docker', ['image', 'inspect', DOCKER_IMAGE], (err) => {
      resolve(!err);
    });
  });
}

// ============================================================
// Восстановление состояния при рестарте сервера
// ============================================================

/** Проверить, не запущен ли контейнер пайплайна (после перезапуска сервера) */
export async function recoverState(): Promise<void> {
  const isDockerAvailable = await checkDocker();
  if (!isDockerAvailable) return;

  return new Promise((resolve) => {
    execFile(
      'docker',
      ['ps', '--filter', `ancestor=${DOCKER_IMAGE}`, '--format', '{{.Names}}'],
      (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve();
          return;
        }

        // Контейнер найден — восстанавливаем состояние "running"
        const containerName = stdout.trim().split('\n')[0];
        state.status = 'running';
        state.containerId = containerName;
        state.runId = containerName.replace('pipeline-', '');

        console.log(`[dockerService] Обнаружен запущенный контейнер: ${containerName}`);
        resolve();
      },
    );
  });
}

// ============================================================
// Утилиты
// ============================================================

/** Форматирует дату в ID запуска: YYYY-MM-DD_HHmmss */
function formatRunId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
