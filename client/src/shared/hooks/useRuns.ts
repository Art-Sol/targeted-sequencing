import { getRuns } from '../api/client';
import type { RunInfo } from '../model/types';
import { useFetch, type UseFetchOptions, type UseFetchReturn } from './useFetch';

// ============================================================
// useRuns — список запусков пайплайна (история)
// ============================================================

/**
 * Хук загружает список всех запусков пайплайна (новые сверху).
 */
export function useRuns(options: UseFetchOptions = {}): UseFetchReturn<RunInfo[]> {
  return useFetch(getRuns, options);
}
