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
} from '../consts';

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
}

const state: PipelineState = {
  status: 'idle',
  runId: null,
  containerId: null,
  exitCode: null,
  error: null,
  stderrTail: [],
};

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
  };
}

/** Запустить Docker-контейнер с пайплайном */
export async function runPipeline(): Promise<{ runId: string }> {
  if (state.status === 'running') {
    throw Object.assign(new Error('Пайплайн уже запущен'), { statusCode: 409 });
  }

  // Генерируем уникальный ID запуска (формат: 2024-01-15_143022)
  const now = new Date();
  const runId = formatRunId(now);

  // Создаём папки для вывода и логов
  const runOutputDir = path.join(OUTPUT_DIR, runId);
  await fs.mkdir(runOutputDir, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });

  // Путь к файлу результатов внутри контейнера
  const resultsPathInContainer = '/app/output/results.json';

  // Путь к лог-файлу на хосте
  const logPath = path.join(LOGS_DIR, `pipeline_${runId}.log`);

  // Сбрасываем состояние
  state.status = 'running';
  state.runId = runId;
  state.containerId = null;
  state.exitCode = null;
  state.error = null;
  state.stderrTail = [];

  // Формируем аргументы docker run
  const args = [
    'run',
    '--rm',
    '--name',
    `pipeline-${runId}`,
    // Монтирование томов (точечное, не -w /work!)
    '-v',
    `${READS_LIST_PATH}:/app/list_reads.txt:ro`,
    '-v',
    `${INPUT_DATA_DIR}:/app/input_data:ro`,
    '-v',
    `${runOutputDir}:/app/output`,
    DOCKER_IMAGE,
    // Аргументы пайплайна
    '--reads-list',
    '/app/list_reads.txt',
    '--output',
    resultsPathInContainer,
    '--threads',
    String(PIPELINE_THREADS),
  ];

  // Запускаем Docker-контейнер
  const child = spawn('docker', args);

  state.containerId = `pipeline-${runId}`;

  // Открываем поток записи в лог-файл
  const logStream = await fs.open(logPath, 'w');

  // Захватываем stdout
  child.stdout.on('data', (data: Buffer) => {
    const line = `[stdout] ${new Date().toISOString()} ${data.toString()}`;
    logStream.write(line);
  });

  // Захватываем stderr (последние 50 строк храним в памяти для UI)
  child.stderr.on('data', (data: Buffer) => {
    const text = data.toString();
    const line = `[stderr] ${new Date().toISOString()} ${text}`;
    logStream.write(line);

    // Сохраняем последние строки stderr для отображения ошибок в UI
    const lines = text.split('\n').filter((l) => l.trim());
    state.stderrTail.push(...lines);
    if (state.stderrTail.length > 50) {
      state.stderrTail = state.stderrTail.slice(-50);
    }
  });

  // Обработка завершения процесса
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
  });

  // Обработка ошибки запуска (Docker не найден, образ не найден)
  child.on('error', (err) => {
    logStream.close();

    state.status = 'error';
    state.containerId = null;

    if ('code' in err && err.code === 'ENOENT') {
      state.error = 'Docker не найден. Убедитесь, что Docker установлен и запущен.';
    } else {
      state.error = err.message;
    }
  });

  return { runId };
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
