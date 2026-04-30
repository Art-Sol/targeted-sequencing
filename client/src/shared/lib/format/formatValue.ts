import type { MetricType } from '../../model/types';

/**
 * Форматирует число в зависимости от метрики:
 * - mapped_reads — целое с разделителями разрядов ("1 234 567")
 * - rpkm — с двумя знаками после запятой ("12.34")
 */
export function formatValue(value: number, metric: MetricType): string {
  if (metric === 'rpkm') return value.toFixed(2);
  return value.toLocaleString('ru-RU');
}
