import type { PipelineResults, MetricType } from '../../model/types';
import { buildDeterminantDisplayMap } from '../format/formatDeterminantId';

// ============================================================
// Преобразование PipelineResults → матрица для таблицы
// ============================================================
//
// Зачем это нужно. В сыром JSON у разных образцов могут быть РАЗНЫЕ
// наборы detected determinants (если таргет не обнаружен, пайплайн
// может не включать его в массив). Для табличного UI нужна
// единообразная сетка: все строки имеют одинаковый набор колонок,
// отсутствующие значения = 0 («таргет не обнаружен»).
//
// Также тут делается выбор метрики (mapped_reads / rpkm): в таблицу
// идут значения ТОЛЬКО одной метрики. Переключение — это повторный
// прогон этой функции с другим параметром.
// ============================================================

/** Одна строка таблицы — образец со всеми его метриками по таргетам */
export interface ResultsRow {
  /** React-ключ. sample_id уникален в пределах запуска. */
  key: string;
  /** Идентификатор образца — для первой (sticky) колонки таблицы. */
  sample_id: string;
  /**
   * Остальные поля — числовые значения метрики по каждому determinant_id.
   * Ant Design Table обращается к ним через `dataIndex: determinant_id`.
   */
  [determinantId: string]: string | number;
}

/** Результат трансформации: готовые строки + список имён колонок */
export interface ResultsMatrix {
  /** Отсортированный union всех determinant_id — используется для построения колонок */
  determinantIds: string[];
  /** Строки — по одной на каждый образец */
  rows: ResultsRow[];
  /** Соответствие исходный determinant_id → отображаемое имя для заголовка колонки.
   *  Шаренный источник истины для UI-таблицы и CSV-экспорта — гарантирует,
   *  что header в файле и колонка на экране называются одинаково. */
  displayMap: Map<string, string>;
}

/**
 * Преобразует сырые результаты пайплайна в матрицу образцы × таргеты.
 *
 * @param results — JSON от сервера
 * @param metric  — какую метрику класть в ячейки: 'mapped_reads' или 'rpkm'
 */
export function buildResultsMatrix(results: PipelineResults, metric: MetricType): ResultsMatrix {
  // --- Шаг 1: собираем union всех determinant_id ---
  const allIds = new Set<string>();
  for (const sample of results.samples) {
    for (const d of sample.determinants) {
      allIds.add(d.determinant_id);
    }
  }

  // Сортируем алфавитно — даёт предсказуемый, стабильный порядок колонок.
  const determinantIds = Array.from(allIds).sort();

  // --- Шаг 2: строим строки, заполняя недостающие ячейки нулями ---
  const rows: ResultsRow[] = results.samples.map((sample) => {
    const byId = new Map(sample.determinants.map((d) => [d.determinant_id, d]));

    const row: ResultsRow = {
      key: sample.sample_id,
      sample_id: sample.sample_id,
    };

    // Ключевой момент: проходим по ПОЛНОМУ списку determinantIds,
    // а не только по тому, что есть в sample.determinants. Это и есть
    // «заполнение нулями» — если у образца таргета нет, кладём 0.
    for (const id of determinantIds) {
      const d = byId.get(id);
      row[id] = d ? d[metric] : 0;
    }

    return row;
  });

  const displayMap = buildDeterminantDisplayMap(determinantIds);

  return { determinantIds, rows, displayMap };
}
