import { useState } from 'react';
import { NewAnalysisPage, HistoryPage } from '../pages';
import { AppLayout } from './layout/layout';
import { DockerCheck, HeaderNav, PageNames } from '../widgets';
import { useHealth } from '../shared/hooks/useHealth';
import { useRuns } from '../shared/hooks/useRuns';
import { usePipelineStatus } from '../shared/hooks/usePipelineStatus';
import type { MetricType } from '../shared/model/types';

export const App = () => {
  const { data: health, loading: healthLoading, refetch: refetchHealth } = useHealth();
  const { data: runs, loading: runsLoading } = useRuns();
  const [currentPage, setCurrentPage] = useState<PageNames>(PageNames.NEW);
  const [currentStep, setCurrentStep] = useState(0);
  const [metric, setMetric] = useState<MetricType>('mapped_reads');
  const pipeline = usePipelineStatus();

  const isHealthOk = Boolean(health?.docker && health?.daemon && health?.image);
  const hasSuccessfulRun = Boolean(runs?.some((r) => r.hasResults));

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
          />
        )}
      </DockerCheck>
    </AppLayout>
  );
};
