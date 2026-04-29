import { useMemo } from 'react';
import { Table, Flex, Typography, Card } from 'antd';
import type { TableColumnsType } from 'antd';
import type { PipelineResults, MetricType } from '../../../shared/model/types';
import { buildResultsMatrix, type ResultsRow } from '../../../shared/lib/results/buildMatrix';
import { MetricToggle } from './MetricToggle';
import classes from './ResultsTable.module.css';

const { Text } = Typography;

interface ResultsTableProps {
  results: PipelineResults;
  /**
   * Текущая метрика. Состояние поднято в родителя (UploadPage), потому что
   * та же метрика используется кнопкой экспорта CSV, живущей в StepActions.
   */
  metric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

// ============================================================
// ResultsTable — таблица результатов пайплайна
// ============================================================

/**
 * Форматирует число в зависимости от метрики:
 * - mapped_reads — целое с разделителями разрядов ("1 234 567")
 * - rpkm — с двумя знаками после запятой ("12.34")
 */
function formatValue(value: number, metric: MetricType): string {
  if (metric === 'rpkm') return value.toFixed(2);
  return value.toLocaleString('ru-RU');
}

export const ResultsTable = ({ results, metric, onMetricChange }: ResultsTableProps) => {
  const matrix = useMemo(() => buildResultsMatrix(results, metric), [results, metric]);

  const columns = useMemo<TableColumnsType<ResultsRow>>(() => {
    const sampleColumn = {
      title: 'Образец',
      dataIndex: 'sample_id',
      key: 'sample_id',
      fixed: 'left' as const,
      width: 180,
    };

    const determinantColumns = matrix.determinantIds.map((id) => ({
      title: id.split('|').join(' | '),
      dataIndex: id,
      key: id,
      align: 'right' as const,
      render: (value: number) => formatValue(value, metric),
      onHeaderCell: () => ({ className: classes.nowrapHeader }),
      onCell: (row: ResultsRow) => ({
        className: row[id] === 0 ? classes.zeroCell : undefined,
      }),
    }));

    return [sampleColumn, ...determinantColumns];
  }, [matrix.determinantIds, metric]);

  const cardTitle = (
    <Flex justify="space-between" align="center" className={classes.cardTitle}>
      <Text strong>
        Образцов: {matrix.rows.length} · Таргетов: {matrix.determinantIds.length}
      </Text>
      <Flex align="center">
        <Text className={classes.metricLabel}>Метрика:</Text>
        <MetricToggle value={metric} onChange={onMetricChange} />
      </Flex>
    </Flex>
  );

  return (
    <Card title={cardTitle} size="small">
      <Table<ResultsRow>
        dataSource={matrix.rows}
        columns={columns}
        scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
        pagination={false}
        bordered
        size="small"
      />
    </Card>
  );
};
