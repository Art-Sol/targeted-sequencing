import { useEffect, useRef } from 'react';
import { Flex, Spin, Alert, message } from 'antd';
import { PipelineControls, ResultsTable, RunSelector } from '../../../../widgets';
import type {
  PipelineResults,
  PipelineStatus,
  MetricType,
  RunInfo,
} from '../../../../shared/model/types';

// ============================================================
// Шаг 3 (currentStep=2): статус анализа + результаты
// ============================================================
//
// Визуализацию состояний idle/running/error/done целиком делает
// PipelineControls (круглый прогресс, алерты). Здесь добавляется только
// блок результатов после done и тост на завершении анализа.
// ============================================================

interface AnalysisStepContentProps {
  pipelineStatus: PipelineStatus;
  pipelineError?: string;
  samplesProcessed?: number;
  totalSamples?: number;
  results: PipelineResults | null;
  resultsLoading: boolean;
  resultsError: string | null;
  /**
   * Текущая метрика и её сеттер. Состояние поднято в UploadPage —
   * та же метрика нужна кнопке экспорта CSV в StepActions.
   */
  metric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  /** Список запусков для селектора истории. */
  runs: RunInfo[] | null;
  runsLoading: boolean;
  selectedRunId?: string;
  onSelectedRunIdChange: (runId: string) => void;
}

export const AnalysisStepContent = ({
  pipelineStatus,
  pipelineError,
  samplesProcessed,
  totalSamples,
  results,
  resultsLoading,
  resultsError,
  metric,
  onMetricChange,
  runs,
  runsLoading,
  selectedRunId,
  onSelectedRunIdChange,
}: AnalysisStepContentProps) => {
  const prevStatusRef = useRef<PipelineStatus | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === 'running') {
      if (pipelineStatus === 'done') {
        message.success('Анализ успешно завершён');
      } else if (pipelineStatus === 'error') {
        message.error('Пайплайн завершился с ошибкой');
      }
    }
    prevStatusRef.current = pipelineStatus;
  }, [pipelineStatus]);

  return (
    <Flex vertical gap={16}>
      <PipelineControls
        status={pipelineStatus}
        error={pipelineError}
        samplesProcessed={samplesProcessed}
        totalSamples={totalSamples}
      />

      {pipelineStatus === 'done' && (
        <>
          {runs && runs.length > 0 && (
            <RunSelector
              runs={runs}
              value={selectedRunId}
              onChange={onSelectedRunIdChange}
              loading={runsLoading}
            />
          )}
          {resultsLoading && <Spin tip="Загрузка результатов..." />}
          {resultsError && (
            <Alert
              type="error"
              message="Не удалось загрузить результаты"
              description={resultsError}
            />
          )}
          {results && (
            <ResultsTable results={results} metric={metric} onMetricChange={onMetricChange} />
          )}
        </>
      )}
    </Flex>
  );
};
