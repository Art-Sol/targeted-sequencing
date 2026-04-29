import axios from 'axios';
import { getResults } from '../api/client';
import type { PipelineResults } from '../model/types';
import { useFetch, type UseFetchOptions, type UseFetchReturn } from './useFetch';

// ============================================================
// useResults — результаты пайплайна
// ============================================================

/**
 * Делает запрос к /api/results; при 404 возвращает null вместо бросания ошибки.
 *
 * Вынесена на уровень модуля (а не inline в хук) — это даёт стабильную
 * ссылку на функцию, что важно для useFetch и React-линтинга.
 */
async function fetchResultsOrNull(signal: AbortSignal): Promise<PipelineResults | null> {
  try {
    return await getResults(signal);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Хук загружает результаты последнего запуска пайплайна.
 *
 * Состояния:
 * - loading=true — выполняется запрос
 * - data=null, error=null — запусков ещё не было (404 от сервера)
 * - data=PipelineResults — есть результаты
 * - error=строка — ошибка запроса (500, сеть и т.п.)
 *
 * @param options.enabled — если false, хук не делает запрос (удобно когда пайплайн
 *                          ещё не завершился, данных ждать рано)
 */
export function useResults(options: UseFetchOptions = {}): UseFetchReturn<PipelineResults | null> {
  return useFetch(fetchResultsOrNull, options);
}
