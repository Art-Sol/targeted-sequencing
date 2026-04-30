import { checkHealth } from '../api/client';
import type { HealthResponse } from '../model/types';
import { useFetch, type UseFetchOptions, type UseFetchReturn } from './useFetch';

/** Хук проверяет Docker-окружение через `/api/health`. */
export function useHealth(options: UseFetchOptions = {}): UseFetchReturn<HealthResponse> {
  return useFetch(checkHealth, options);
}
