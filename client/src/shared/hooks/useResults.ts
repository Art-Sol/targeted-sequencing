import axios from 'axios';
import { getResults, getResultsByRunId } from '../api/client';
import type { PipelineResults } from '../model/types';
import { useFetch, type UseFetchOptions, type UseFetchReturn } from './useFetch';

// ============================================================
// useResults — результаты пайплайна (latest или конкретный runId)
// ============================================================

export interface UseResultsOptions extends Pick<UseFetchOptions, 'enabled'> {
  /** Если задан — грузим конкретный запуск; иначе — последний. */
  runId?: string;
}

/** Хук загружает результаты пайплайна; при 404 возвращает null вместо ошибки. */
export function useResults({
  runId,
  enabled,
}: UseResultsOptions = {}): UseFetchReturn<PipelineResults | null> {
  return useFetch(
    async (signal) => {
      try {
        return runId ? await getResultsByRunId(runId, signal) : await getResults(signal);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    { enabled, key: runId ?? null },
  );
}
