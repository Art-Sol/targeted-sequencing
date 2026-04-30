import { useMemo } from 'react';
import { Table, Flex, Typography, Card, Skeleton } from 'antd';
import type { TableColumnsType } from 'antd';
import type { PipelineResults, MetricType } from '../../../shared/model/types';
import { buildResultsMatrix, type ResultsRow } from '../../../shared/lib/results/buildMatrix';
import { formatValue } from '../../../shared/lib/format/formatValue';
import { MetricToggle } from '../../../shared/ui/MetricToggle/MetricToggle';
import classes from './ResultsTable.module.css';

const { Text } = Typography;

const SKELETON_ROW_COUNT = 8;
const SKELETON_COL_COUNT = 4;
const SKELETON_ROWS = Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => ({
  key: `skeleton_${i}`,
}));

interface ResultsTableProps {
  isLoading?: boolean;
  results?: PipelineResults;
  metric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

// ============================================================
// ResultsTable — таблица результатов пайплайна (с встроенным скелетоном)
// ============================================================

export const ResultsTable = ({ isLoading, results, metric, onMetricChange }: ResultsTableProps) => {
  const showSkeleton = Boolean(isLoading || !results);

  const matrix = useMemo(
    () => (results && !isLoading ? buildResultsMatrix(results, metric) : null),
    [results, isLoading, metric],
  );

  const columns = useMemo<TableColumnsType<ResultsRow>>(() => {
    if (!matrix) {
      const sampleColumn = {
        title: <Skeleton.Input active size="small" />,
        dataIndex: 'sample_id',
        key: 'sample_id',
        fixed: 'left' as const,
        width: 180,
        render: () => <Skeleton.Input active size="small" block />,
      };
      const determinantColumns = Array.from({ length: SKELETON_COL_COUNT }, (_, i) => ({
        title: <Skeleton.Input active size="small" />,
        dataIndex: `__skeleton_${i}`,
        key: `__skeleton_${i}`,
        align: 'right' as const,
        render: () => <Skeleton.Input active size="small" block />,
      }));
      return [sampleColumn, ...determinantColumns];
    }

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
  }, [matrix, metric]);

  const dataSource = matrix?.rows ?? (SKELETON_ROWS as unknown as ResultsRow[]);

  const cardTitle = (
    <Flex justify="space-between" align="center" className={classes.cardTitle}>
      {showSkeleton || !matrix ? (
        <Skeleton.Input active size="small" />
      ) : (
        <Text strong>
          Образцов: {matrix.rows.length} · Таргетов: {matrix.determinantIds.length}
        </Text>
      )}
      {showSkeleton ? (
        <Skeleton.Input active size="small" />
      ) : (
        <Flex align="center">
          <Text className={classes.metricLabel}>Метрика:</Text>
          <MetricToggle value={metric} onChange={onMetricChange} />
        </Flex>
      )}
    </Flex>
  );

  return (
    <Card title={cardTitle} size="small">
      <Table<ResultsRow>
        dataSource={dataSource}
        columns={columns}
        scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
        pagination={false}
        bordered
        size="small"
      />
    </Card>
  );
};
