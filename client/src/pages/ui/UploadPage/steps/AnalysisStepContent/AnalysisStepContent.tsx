import { useEffect, useRef } from 'react';
import { Flex, Alert, message } from 'antd';
import { PipelineStatus, ResultsTable } from '../../../../../widgets';
import type {
  PipelineResults,
  PipelineStatus as PipelineStatusType,
  MetricType,
} from '../../../../../shared/model/types';

// ============================================================
// Шаг 3 (currentStep=2): статус анализа + результаты
// ============================================================

interface AnalysisStepContentProps {
  pipelineStatus: PipelineStatusType;
  /** Имя запуска. Прокидывается в ResultsTable как заголовок Card'а. */
  runName?: string;
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
}

export const AnalysisStepContent = ({
  pipelineStatus,
  runName,
  pipelineError,
  samplesProcessed,
  totalSamples,
  results,
  resultsLoading,
  resultsError,
  metric,
  onMetricChange,
}: AnalysisStepContentProps) => {
  const prevStatusRef = useRef<PipelineStatusType | null>(null);
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
      <PipelineStatus
        status={pipelineStatus}
        error={pipelineError}
        samplesProcessed={samplesProcessed}
        totalSamples={totalSamples}
      />

      {pipelineStatus === 'done' && (
        <>
          {resultsError && (
            <Alert
              type="error"
              message="Не удалось загрузить результаты"
              description={`${resultsError} Возможно анализ был удален, запустите анализ еще раз`}
            />
          )}
          {!resultsError && (
            <ResultsTable
              isLoading={resultsLoading}
              results={results ?? undefined}
              metric={metric}
              onMetricChange={onMetricChange}
              runName={runName}
            />
          )}
        </>
      )}
    </Flex>
  );
};
