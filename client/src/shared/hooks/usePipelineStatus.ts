import { useState, useEffect, useCallback } from 'react';
import { getPipelineStatus } from '../api/client';
import type { PipelineStatusResponse } from '../model/types';

const POLL_INTERVAL = 2000; // 2 секунды

/**
 * Хук для отслеживания статуса пайплайна.
 *
 * Polling работает только когда статус === 'running'.
 * В состояниях idle / done / error — не опрашивает сервер
 * (незачем тратить ресурсы, статус не изменится сам).
 *
 * @returns { status, runId, error, refresh }
 *   - status  — текущий статус пайплайна
 *   - runId   — ID текущего/последнего запуска
 *   - error   — текст ошибки (если статус === 'error')
 *   - refresh — функция для ручного обновления (вызывать после runPipeline)
 */
export function usePipelineStatus() {
  const [data, setData] = useState<PipelineStatusResponse>({ status: 'idle' });

  const refresh = useCallback(async () => {
    try {
      const result = await getPipelineStatus();
      setData(result);
    } catch {
      console.error('Ошибка при получении статуса пайплайна');
    }
  }, []);

  // Первый запрос — узнать текущий статус при монтировании
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling: опрашиваем сервер только когда пайплайн работает
  useEffect(() => {
    if (data.status !== 'running') return;

    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [data.status, refresh]);

  return {
    status: data.status,
    runId: data.runId,
    error: data.error,
    refresh,
  };
}
