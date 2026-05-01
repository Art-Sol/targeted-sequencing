import { useState } from 'react';
import { message } from 'antd';
import { NewAnalysisPage, HistoryPage } from '../pages';
import { AppLayout } from './layout/layout';
import { DockerCheck, HeaderNav, PageNames } from '../widgets';
import { useHealth } from '../shared/hooks/useHealth';
import { useRuns } from '../shared/hooks/useRuns';
import { usePipelineStatus } from '../shared/hooks/usePipelineStatus';
import { deleteRun, deleteAllRuns } from '../shared/api/client';
import type { MetricType } from '../shared/model/types';

export const App = () => {
  const { data: health, loading: healthLoading, refetch: refetchHealth } = useHealth();
  const { data: runs, loading: runsLoading, refetch: refetchRuns } = useRuns();
  const [currentPage, setCurrentPage] = useState<PageNames>(PageNames.NEW);
  const [currentStep, setCurrentStep] = useState(0);
  const [metric, setMetric] = useState<MetricType>('mapped_reads');
  const pipeline = usePipelineStatus();

  const isHealthOk = Boolean(health?.docker && health?.daemon && health?.image);
  const hasSuccessfulRun = Boolean(runs?.some((r) => r.hasResults));

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

  return (
    <AppLayout
      headerActions={
        <HeaderNav
          current={currentPage}
          onChange={setCurrentPage}
          newAnalysisDisabled={!isHealthOk}
          historyDisabled={!isHealthOk || !hasSuccessfulRun}
        />
      }
    >
      <DockerCheck health={health} loading={healthLoading} onRetry={refetchHealth}>
        {currentPage === PageNames.NEW ? (
          <NewAnalysisPage
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            metric={metric}
            setMetric={setMetric}
            pipeline={pipeline}
          />
        ) : (
          <HistoryPage
            runs={runs}
            runsLoading={runsLoading}
            metric={metric}
            onMetricChange={setMetric}
            onNavigateToNew={() => setCurrentPage(PageNames.NEW)}
            onDeleteRun={handleDeleteRun}
            onDeleteAllRuns={handleDeleteAllRuns}
          />
        )}
      </DockerCheck>
    </AppLayout>
  );
};
