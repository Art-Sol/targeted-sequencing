import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { PipelineResults, MetricType } from '../../model/types';
import { buildCsv } from '../../lib/results/buildCsv';
import { buildResultsMatrix } from '../../lib/results/buildMatrix';
import { downloadFile } from '../../lib/download';

// ============================================================
// CsvExportButton — кнопка скачивания результатов в CSV
// ============================================================
//
// Принцип WYSIWYG: в файл попадает та же матрица, что показана в таблице —
// тот же набор образцов, те же determinant_id, та же выбранная метрика.
// Матрица собирается внутри (на клик), а не передаётся пропом — это даёт
// кнопке полную автономность: достаточно results + metric + runId.
// ============================================================

interface CsvExportButtonProps {
  results: PipelineResults;
  metric: MetricType;
  /** Идентификатор запуска для имени файла. Если не задан — подставится 'results' */
  runId?: string;
  /** Пользовательское имя запуска. Если задано — добавляется префиксом в имя файла. */
  name?: string;
}

const MAX_NAME_PART = 50;

/**
 * Готовит имя запуска для использования в имени CSV-файла:
 * заменяет пробелы на `_` и обрезает до MAX_NAME_PART символов.
 * Остальные символы безопасны — сервер уже отфильтровал на этапе ввода.
 */
function sanitizeFilenamePart(name: string): string {
  return name.replace(/ /g, '_').slice(0, MAX_NAME_PART);
}

export const CsvExportButton = ({ results, metric, runId, name }: CsvExportButtonProps) => {
  const handleClick = () => {
    const matrix = buildResultsMatrix(results, metric);
    const csv = buildCsv(matrix, metric);
    const safeRunId = runId ?? 'results';
    const namePart = name ? `${sanitizeFilenamePart(name)}_` : '';
    const filename = `${namePart}${safeRunId}_${metric}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
  };

  return (
    <Button type="primary" icon={<DownloadOutlined />} onClick={handleClick}>
      Скачать CSV
    </Button>
  );
};
