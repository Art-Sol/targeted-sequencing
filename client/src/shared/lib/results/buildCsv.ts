import type { MetricType } from '../../model/types';
import type { ResultsMatrix } from './buildMatrix';

// ============================================================
// Преобразование ResultsMatrix → CSV-строка
// ============================================================

/** Перевод строки по RFC 4180 — CRLF, корректно везде */
const CRLF = '\r\n';

/** Разделитель колонок. Точка с запятой — это «европейский CSV»:
 *  Excel в русской/европейской локали парсит её корректно из коробки
 *  (системный List Separator = `;`), тогда как `,` он считает десятичным
 *  разделителем и в столбцы не разбивает. Pandas/R читают такой файл
 *  с явным `sep=';'` (R даже имеет встроенный `read.csv2()`). */
const DELIMITER = ';';

/** UTF-8 BOM — три байта EF BB BF, видимый сигнал «это UTF-8».
 *  Без него Excel в русской локали откроет файл как Windows-1251,
 *  и кириллица в sample_id/determinant_id превратится в кракозябры. */
const BOM = '﻿';

/**
 * Экранирует одну ячейку CSV.
 *
 * Правила:
 *  - Если в значении встречается разделитель (`;`), двойная кавычка или
 *    перевод строки — значение нужно обернуть в двойные кавычки.
 *  - Внутренние двойные кавычки удваиваются: `"` → `""`.
 *  - Числа и «безопасные» строки выводятся как есть (без кавычек).
 *
 * Запятые экранировать не нужно: с `;` как разделителем `,` — обычный
 * безопасный символ внутри ячейки.
 */
function escapeCell(value: string | number): string {
  const str = String(value);

  const needsQuoting = /[";\r\n]/.test(str);
  if (!needsQuoting) return str;

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Форматирует числовое значение метрики для CSV.
 *
 * - mapped_reads — целые, без разделителей разрядов
 * - rpkm — два знака после запятой, точка как десятичный разделитель
 *
 * Точка (а не запятая) — стандарт машинно-читаемых форматов: pandas/R
 * парсят `12.34` без дополнительных опций.
 */
function formatNumber(value: number, metric: MetricType): string {
  if (metric === 'rpkm') return value.toFixed(2);
  return String(value);
}

/**
 * Собирает CSV-строку из матрицы результатов.
 *
 * Формат (разделитель `;`):
 *   sample_id;<determinant_1>;<determinant_2>;...
 *   <sample_1>;<value>;<value>;...
 *   <sample_2>;<value>;<value>;...
 *
 * Возвращает строку с UTF-8 BOM в начале и CRLF между строками.
 */
export function buildCsv(matrix: ResultsMatrix, metric: MetricType): string {
  // --- Заголовок ---
  const header = ['sample_id', ...matrix.determinantIds].map(escapeCell).join(DELIMITER);

  // --- Строки данных ---
  const dataLines = matrix.rows.map((row) => {
    const cells: string[] = [escapeCell(row.sample_id)];

    for (const id of matrix.determinantIds) {
      const value = row[id];
      const numeric = typeof value === 'number' ? value : 0;
      cells.push(escapeCell(formatNumber(numeric, metric)));
    }

    return cells.join(DELIMITER);
  });

  return BOM + [header, ...dataLines].join(CRLF) + CRLF;
}
