import { useEffect } from 'react';
import { getPipelineStatus } from '../api/client';
import { useFetch } from './useFetch';

// Интервал polling'а во время `running`. 1 секунда — компромисс:
// - На быстрых тестовых запусках (2-3 сек) успеваем поймать промежуточные
//   состояния и отрисовать прогресс.
// - На длинных прогонах (минуты-десятки минут) нагрузка незначительна:
//   1 запрос/сек × 30 мин = 1800 дешёвых запросов к in-memory state.
const POLL_INTERVAL = 1000;

// ============================================================
// usePipelineStatus — статус пайплайна + polling
// ============================================================

/**
 * Хук отслеживает статус пайплайна.
 *
 * Возвращает:
 * - status  — 'idle' | 'running' | 'done' | 'error' (по умолчанию 'idle')
 * - runId   — ID текущего/последнего запуска
 * - error   — текст ошибки пайплайна (из /api/pipeline/status), если status === 'error'
 * - refresh — ручное обновление (вызывать после запуска пайплайна для быстрой смены UI)
 */
export function usePipelineStatus() {
  const { data, refetch } = useFetch(getPipelineStatus);

  // Слой polling: активен только в состоянии 'running'.
  useEffect(() => {
    if (data?.status !== 'running') return;

    const interval = setInterval(refetch, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [data?.status, refetch]);

  return {
    status: data?.status ?? 'idle',
    runId: data?.runId,
    error: data?.error,
    samplesProcessed: data?.samplesProcessed,
    totalSamples: data?.totalSamples,
    refresh: refetch,
  };
}
