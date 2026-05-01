import { useState, useEffect } from 'react';
import { Typography, Layout, Flex, Button, Spin, Alert, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { MetricType, RunInfo } from '../../../shared/model/types';
import { useResults } from '../../../shared/hooks/useResults';
import { deleteRun, deleteAllRuns } from '../../../shared/api/client';
import { ResultsTable, RunSelector } from '../../../widgets';
import { CsvExportButton } from '../../../shared/ui/CsvExportButton/CsvExportButton';

import classes from './HistoryPage.module.css';

const { Title, Text } = Typography;
const { Content } = Layout;

interface HistoryPageProps {
  runs: RunInfo[] | null;
  runsLoading: boolean;
  metric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onNavigateToNew: () => void;
  refetchRuns: () => void;
}

export const HistoryPage = ({
  runs,
  runsLoading,
  metric,
  onMetricChange,
  onNavigateToNew,
  refetchRuns,
}: HistoryPageProps) => {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();

  const handleDeleteRun = async (runId: string) => {
    try {
      await deleteRun(runId);
      message.success('Запуск удалён');
      refetchRuns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось удалить запуск';
      message.error(msg);
    }
  };

  const handleDeleteAllRuns = async () => {
    try {
      await deleteAllRuns();
      message.success('История запусков очищена');
      refetchRuns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось очистить историю';
      message.error(msg);
    }
  };

  const {
    data: results,
    loading: resultsLoading,
    error: resultsError,
  } = useResults({
    runId: selectedRunId,
    enabled: selectedRunId !== undefined,
  });

  // Авто-выбор: при первой загрузке списка — самый свежий успешный запуск.
  useEffect(() => {
    if (selectedRunId === undefined && runs && runs.length > 0) {
      const firstSuccessful = runs.find((r) => r.hasResults);
      if (firstSuccessful) setSelectedRunId(firstSuccessful.runId);
    }
  }, [runs, selectedRunId]);

  // Авто-сброс: если выбранный runId исчез из списка (был удалён) —
  // сбросить selectedRunId, чтобы effect выше выбрал следующий доступный.
  useEffect(() => {
    if (selectedRunId !== undefined && runs && !runs.some((r) => r.runId === selectedRunId)) {
      setSelectedRunId(undefined);
    }
  }, [runs, selectedRunId]);

  if (!runs && runsLoading) {
    return (
      <Flex justify="center" align="center" flex={1}>
        <Spin size="large" tip="Загрузка истории..." />
      </Flex>
    );
  }

  if ((runs && runs.length === 0) || !runs || (!results && !resultsLoading)) {
    return (
      <Flex justify="center" align="center" flex={1}>
        <Alert
          className={classes.alert}
          type="info"
          message="Нет завершённых анализов"
          action={
            <Button
              type="primary"
              size="middle"
              icon={<PlayCircleOutlined />}
              onClick={onNavigateToNew}
            >
              Запустить новый анализ
            </Button>
          }
        />
      </Flex>
    );
  }

  if (resultsError) {
    return (
      <Flex justify="center" align="center" flex={1}>
        <Alert type="error" message="Не удалось загрузить результаты" description={resultsError} />
      </Flex>
    );
  }

  return (
    <Content className={classes.content}>
      <Flex vertical gap={16} className={classes.body}>
        <Title level={4}>Выполненные анализы</Title>

        <Flex gap={8} justify="space-between">
          <Flex gap={8} align="center">
            <Button icon={<PlayCircleOutlined />} onClick={onNavigateToNew}>
              Новый анализ
            </Button>
            {results && <CsvExportButton results={results} metric={metric} runId={selectedRunId} />}
          </Flex>
          <Flex align="center" gap={8}>
            <Text>Ранее выполненные анализы:</Text>
            <RunSelector
              runs={runs}
              value={selectedRunId}
              onChange={setSelectedRunId}
              loading={runsLoading}
              onDeleteRun={handleDeleteRun}
              onDeleteAll={handleDeleteAllRuns}
            />
          </Flex>
        </Flex>

        <ResultsTable
          isLoading={resultsLoading}
          results={results ?? undefined}
          metric={metric}
          onMetricChange={onMetricChange}
        />
      </Flex>
    </Content>
  );
};
