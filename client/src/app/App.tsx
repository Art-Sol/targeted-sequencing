import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { NewAnalysisPage, HistoryPage } from '../pages';
import { AppLayout } from './layout/layout';
import { DockerCheck, HeaderNav, PageNames } from '../widgets';
import { useHealth } from '../shared/hooks/useHealth';
import { useRuns } from '../shared/hooks/useRuns';
import { usePipelineStatus } from '../shared/hooks/usePipelineStatus';
import type { MetricType } from '../shared/model/types';

export const App = () => {
  const { data: health, loading: healthLoading, refetch: refetchHealth } = useHealth();
  const { data: runs, loading: runsLoading, refetch: refetchRuns } = useRuns();
  const [currentPage, setCurrentPage] = useState<PageNames>(PageNames.NEW);
  const [currentStep, setCurrentStep] = useState(0);
  const [metric, setMetric] = useState<MetricType>('mapped_reads');
  const pipeline = usePipelineStatus();
  const wasImageLoadingRef = useRef(false);

  const isHealthOk = Boolean(
    health?.docker && health?.daemon && health?.image && !healthLoading && !health?.imageLoading,
  );
  const hasSuccessfulRun = Boolean(runs?.some((r) => r.hasResults));

  useEffect(() => {
    if (pipeline.status === 'done' || pipeline.status === 'error') {
      refetchRuns();
    }
  }, [pipeline.status, refetchRuns]);

  // Auto-poll /api/health во время загрузки Docker-образа из bundled tar.
  // Загрузка длится 1-2 минуты — без polling'а UI завис бы на «Загрузка…»
  // пока юзер сам не нажмёт «Проверить снова». При imageLoading=false
  // (загрузка завершена/не начата) effect cleanup'ит interval.
  useEffect(() => {
    if (!health?.imageLoading) return;
    const interval = setInterval(refetchHealth, 3000);
    return () => clearInterval(interval);
  }, [health?.imageLoading, refetchHealth]);

  // Toast при успешной фоновой загрузке образа: ловим переход
  // imageLoading=true → image=true. useRef хранит «была ли загрузка»
  // между рендерами без триггера ре-рендера.
  useEffect(() => {
    if (health?.imageLoading) {
      wasImageLoadingRef.current = true;
    } else if (wasImageLoadingRef.current && health?.image) {
      message.success('Docker-образ успешно загружен');
      wasImageLoadingRef.current = false;
    }
  }, [health?.imageLoading, health?.image]);

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
            refetchRuns={refetchRuns}
          />
        )}
      </DockerCheck>
    </AppLayout>
  );
};
