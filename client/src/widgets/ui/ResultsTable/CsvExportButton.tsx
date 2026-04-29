import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { PipelineResults, MetricType } from '../../../shared/model/types';
import { buildCsv } from '../../../shared/lib/results/buildCsv';
import { buildResultsMatrix } from '../../../shared/lib/results/buildMatrix';
import { downloadFile } from '../../../shared/lib/download';

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
}

export const CsvExportButton = ({ results, metric, runId }: CsvExportButtonProps) => {
  const handleClick = () => {
    const matrix = buildResultsMatrix(results, metric);
    const csv = buildCsv(matrix, metric);
    const safeRunId = runId ?? 'results';
    const filename = `${safeRunId}_${metric}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
  };

  return (
    <Button type="primary" icon={<DownloadOutlined />} onClick={handleClick}>
      Скачать CSV
    </Button>
  );
};
