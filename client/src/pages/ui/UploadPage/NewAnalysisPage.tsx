import { useState, useEffect, useCallback } from 'react';
import { Typography, Layout, Flex, Button, Alert, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { cleanUploads, getUploadStatus, runPipeline } from '../../../shared/api/client';
import type {
  UploadStatusResponse,
  ValidationResult,
  ReadsListEntry,
  MetricType,
} from '../../../shared/model/types';
import { STEPS } from '../../module/consts';
import { formatBytes } from '../../../shared/lib/format/formatBytes';

import classes from './NewAnalysisPage.module.css';
import { Step } from '../../module/types';
import { Stepper, StepActions } from '../../../widgets';
import { CsvExportButton } from '../../../shared/ui/CsvExportButton/CsvExportButton';
import { usePipelineStatus } from '../../../shared/hooks/usePipelineStatus';
import { useResults } from '../../../shared/hooks/useResults';
import { ReadsListStepContent, FastqStepContent, AnalysisStepContent } from './steps';

const { Title, Text } = Typography;
const { Content } = Layout;

interface NewAnalysisPageProps {
  currentStep: number;
  setCurrentStep: (next: number | ((prev: number) => number)) => void;
  metric: MetricType;
  setMetric: (metric: MetricType) => void;
  pipeline: ReturnType<typeof usePipelineStatus>;
}

export const NewAnalysisPage = ({
  currentStep,
  setCurrentStep,
  metric,
  setMetric,
  pipeline,
}: NewAnalysisPageProps) => {
  const [status, setStatus] = useState<UploadStatusResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [entries, setEntries] = useState<ReadsListEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);

  const {
    data: results,
    loading: resultsLoading,
    error: resultsError,
  } = useResults({
    runId: pipeline.runId,
    enabled: pipeline.status === 'done',
  });

  // ------- Получение статуса загрузок с сервера -------

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getUploadStatus();
      setStatus(data);
      setValidation(data.validation);
      if (data.validation.entries.length > 0) {
        setEntries(data.validation.entries);
      }
    } catch {
      // Сервер недоступен — молчим
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ------- Колбэки step-content'ов -------

  const handleReadsListUploaded = (newEntries: ReadsListEntry[]) => {
    setEntries(newEntries);
    refreshStatus();
  };

  const handleFastqUploaded = () => {
    refreshStatus();
  };

  // ------- Навигация между шагами -------

  const stepBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const stepForward = () => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));

  // ------- Action: очистить файлы -------

  const handleClean = async () => {
    setCleanLoading(true);
    try {
      await cleanUploads();
      message.success('Файлы удалены');
      setStatus(null);
      setValidation(null);
      setEntries([]);
      setCurrentStep(0);
      refreshStatus();
      pipeline.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось очистить файлы';
      message.error(msg);
    } finally {
      setCleanLoading(false);
    }
  };

  // ------- Action: запустить анализ (шаг 3) -------

  const handleRun = async () => {
    setRunLoading(true);
    try {
      await runPipeline();
      message.success('Анализ запущен');
      pipeline.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось запустить анализ';
      message.error(msg);
    } finally {
      setRunLoading(false);
    }
  };

  const step = STEPS[currentStep] as Step;

  // ------- Рендер StepActions для текущего шага -------

  const cleanConfirm = {
    confirmTitle: 'Удалить файлы и начать заново?',
    confirmDescription: 'Все загруженные файлы будут удалены.',
    cleanLabel: 'Удалить файлы и начать заново',
  };

  const hasFilesToDelete =
    status?.readsList !== null && status?.readsList !== undefined
      ? true
      : (status?.fastqFiles.length ?? 0) > 0;

  const renderStepActions = () => {
    if (currentStep === 0) {
      return (
        <StepActions
          onForward={entries.length === 0 ? undefined : stepForward}
          onClean={handleClean}
          cleanLoading={cleanLoading}
          cleanDisabled={!hasFilesToDelete}
          {...cleanConfirm}
        />
      );
    }

    if (currentStep === 1) {
      return (
        <StepActions
          onBack={stepBack}
          onForward={validation?.valid ? stepForward : undefined}
          onClean={handleClean}
          cleanLoading={cleanLoading}
          cleanDisabled={!hasFilesToDelete}
          {...cleanConfirm}
        />
      );
    }

    if (currentStep === 2) {
      const isRunning = pipeline.status === 'running';
      return (
        <StepActions
          onBack={isRunning ? undefined : stepBack}
          onClean={handleClean}
          cleanLoading={cleanLoading}
          cleanDisabled={!hasFilesToDelete || isRunning}
          {...cleanConfirm}
        >
          <Button
            type={pipeline.status === 'done' ? 'default' : 'primary'}
            icon={<PlayCircleOutlined />}
            loading={runLoading || isRunning}
            disabled={runLoading || isRunning}
            onClick={handleRun}
          >
            {pipeline.status === 'done' ? 'Запустить ещё раз' : 'Запустить анализ'}
          </Button>
          {pipeline.status === 'done' && results && (
            <CsvExportButton results={results} metric={metric} runId={pipeline.runId} />
          )}
        </StepActions>
      );
    }

    return null;
  };

  const stepActions = renderStepActions();

  return (
    <Content className={classes.content}>
      <Stepper
        currentStep={currentStep}
        steps={STEPS}
        processing={processing}
        entries={entries}
        validation={validation}
        pipelineStatus={pipeline.status}
      />
      <Flex vertical justify="center" gap={16} className={classes.stepContent}>
        <Title level={4}>{step.stepTitle}</Title>
        <Text type="secondary">{step.stepDescription}</Text>

        {status?.diskWarning && (
          <Alert
            type="warning"
            showIcon
            message="Мало свободного места на диске"
            description={`Осталось ${formatBytes(status.diskFreeBytes)}. Рекомендуем очистить место для
                загрузки новых файлов.`}
          />
        )}
        {stepActions}

        {currentStep === 0 && (
          <ReadsListStepContent
            status={status}
            entries={entries}
            onReadsListUploaded={handleReadsListUploaded}
            onProcessingChange={setProcessing}
          />
        )}

        {currentStep === 1 && (
          <FastqStepContent
            status={status}
            validation={validation}
            entries={entries}
            onFastqUploaded={handleFastqUploaded}
            onProcessingChange={setProcessing}
          />
        )}

        {currentStep === 2 && (
          <AnalysisStepContent
            pipelineStatus={pipeline.status}
            pipelineError={pipeline.error}
            samplesProcessed={pipeline.samplesProcessed}
            totalSamples={pipeline.totalSamples}
            results={results}
            resultsLoading={resultsLoading}
            resultsError={resultsError}
            metric={metric}
            onMetricChange={setMetric}
          />
        )}
      </Flex>
    </Content>
  );
};
