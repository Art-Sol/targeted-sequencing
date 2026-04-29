import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// ============================================================
// useFetch — базовый хук загрузки данных
// ============================================================
//
// Задачи, которые он решает за вызывающий код:
//   1. Состояния loading / error / data.
//   2. Отмена «устаревших» запросов через AbortController
//      (если эффект перезапустился или компонент размонтирован).
//   3. Флаг enabled для условной загрузки.
//   4. refetch() для ручного перезапуска.
// ============================================================

export interface UseFetchOptions {
  /**
   * Если false — запрос не выполняется. По умолчанию true.
   * Переход false→true триггерит загрузку автоматически.
   */
  enabled?: boolean;
}

export interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Вытаскивает человекочитаемое сообщение из любой ошибки.
 * Приоритет: тело ответа сервера ({ error: '...' }) → err.message → fallback.
 */
function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && typeof err.response?.data?.error === 'string') {
    return err.response.data.error;
  }
  if (err instanceof Error) return err.message;
  return 'Неизвестная ошибка';
}

/**
 * Базовый хук загрузки данных.
 *
 * @param fetcher — функция, принимающая AbortSignal и возвращающая Promise.
 *                  Её нужно пробросить в axios/fetch, чтобы сеть умела отменять запрос.
 * @param options — { enabled }
 */
export function useFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseFetchOptions = {},
): UseFetchReturn<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  // Счётчик-триггер для refetch: инкремент → useEffect перезапускается.
  const [trigger, setTrigger] = useState(0);

  // «Latest ref»-паттерн: держим актуальный fetcher в ref,
  // чтобы не класть его в deps useEffect. Иначе любой родитель,
  // не обернувший fetcher в useCallback, вызывал бы бесконечный цикл
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // AbortController — стандарт веб-платформы для отмены асинхронных операций.
    // Мы передаём его signal в fetcher → fetcher пробрасывает в axios →
    // если мы вызовем controller.abort(), axios прервёт запрос и бросит
    // ошибку отмены (проверяется через axios.isCancel).
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetcherRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
      } catch (err) {
        // Если запрос был отменён — это не ошибка с точки зрения UI,
        // просто мы его намеренно прервали.
        if (controller.signal.aborted || axios.isCancel(err)) return;
        setError(extractErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchData();

    // Cleanup вызывается при размонтировании компонента, при изменении
    // trigger (refetch), при изменении enabled. В любом из случаев —
    // отменяем in-flight запрос, чтобы он не пытался обновить state.
    return () => controller.abort();
  }, [trigger, enabled]);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  return { data, loading, error, refetch };
}
