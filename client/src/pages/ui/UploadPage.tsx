import { useState, useEffect, useCallback } from 'react';
import { Typography, Layout, Flex, Button, Alert, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { cleanUploads, getUploadStatus, runPipeline } from '../../shared/api/client';
import type {
  UploadStatusResponse,
  ValidationResult,
  ReadsListEntry,
  MetricType,
} from '../../shared/model/types';
import { STEPS } from '../module/consts';
import { formatBytes } from '../../shared/lib/format/formatBytes';

import classes from './UploadPage.module.css';
import { Step } from '../module/types';
import { Stepper, StepActions } from '../../widgets';
import { CsvExportButton } from '../../widgets/ui/ResultsTable/CsvExportButton';
import { usePipelineStatus } from '../../shared/hooks/usePipelineStatus';
import { useResults } from '../../shared/hooks/useResults';
import { useRuns } from '../../shared/hooks/useRuns';
import { ReadsListStepContent, FastqStepContent, AnalysisStepContent } from './steps';

const { Title, Text } = Typography;
const { Content } = Layout;

// ============================================================
// UploadPage — корневая страница флоу загрузки → анализа → результатов
// ============================================================

export const UploadPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<UploadStatusResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [entries, setEntries] = useState<ReadsListEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [metric, setMetric] = useState<MetricType>('mapped_reads');
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const pipeline = usePipelineStatus();

  const {
    data: runs,
    loading: runsLoading,
    refetch: refetchRuns,
  } = useRuns({ enabled: currentStep === 2 });

  const {
    data: results,
    loading: resultsLoading,
    error: resultsError,
  } = useResults({
    runId: selectedRunId,
    enabled: pipeline.status === 'done',
  });

  useEffect(() => {
    if (selectedRunId === undefined && runs && runs.length > 0) {
      const firstSuccessful = runs.find((r) => r.hasResults);
      if (firstSuccessful) setSelectedRunId(firstSuccessful.runId);
    }
  }, [runs, selectedRunId]);

  // Синхронно при transition running→done переключаемся на свежий runId
  // прямо в рендере. Эффект здесь оставил бы кадр со старой таблицей —
  // useEffect выполняется ПОСЛЕ paint'а, и пользователь успевает её увидеть.
  // Паттерн «store info from previous render»: setState в render
  // → React отбрасывает текущий render и перезапускает с обновлённым state.
  const [storedPipelineStatus, setStoredPipelineStatus] = useState(pipeline.status);
  if (storedPipelineStatus !== pipeline.status) {
    setStoredPipelineStatus(pipeline.status);
    if (storedPipelineStatus === 'running' && pipeline.status === 'done' && pipeline.runId) {
      setSelectedRunId(pipeline.runId);
      refetchRuns();
    }
  }

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
      // Polling в usePipelineStatus активен только при 'running'. После clean
      // сервер перевёл state в 'idle' — подтянуть свежий статус надо явно.
      pipeline.refresh();
    } catch (err) {
      // Сервер отдаёт 409 если пайплайн работает → err.response.data.error
      // (axios кладёт это в message если interceptor'ом развернуть; у нас
      // err.message = обычное сообщение axios. Более надёжно — через response).
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
      // Быстро обновляем статус — иначе кнопка может проплёскнуть одно состояние
      // между locaL loading и реальным 'running' с сервера.
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
  //
  // Для каждого шага свой конфиг: какие кнопки показывать, что именно
  // делает «Далее», нужны ли custom-действия. Единый UI в StepActions.

  const cleanConfirm = {
    confirmTitle: 'Удалить файлы и начать заново?',
    confirmDescription: 'Все загруженные файлы будут удалены.',
    cleanLabel: 'Удалить файлы и начать заново',
  };

  // Есть ли что удалять: либо загружен list_reads.txt, либо хоть один FASTQ.
  // Пока status ещё не подгружен с сервера (null) — считаем что удалять нечего,
  // кнопка будет disabled; после первого refreshStatus пересчитается.
  const hasFilesToDelete =
    status?.readsList !== null && status?.readsList !== undefined
      ? true
      : (status?.fastqFiles.length ?? 0) > 0;

  const renderStepActions = () => {
    // Шаг 1 (list_reads.txt): пока не загружено — никаких кнопок.
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

    // Шаг 2 (FASTQ): Назад всегда, Далее — только когда валидация прошла.
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

    // Шаг 3 (Таблица): кнопки видны всегда, но во время работы пайплайна
    // полностью disabled — нельзя ни вернуться, ни очистить, ни запустить
    // повторно. Так пользователь видит, что действия существуют, но сейчас
    // недоступны (вместо «куда-то всё пропало»).
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
            <CsvExportButton
              results={results}
              metric={metric}
              runId={selectedRunId ?? pipeline.runId}
            />
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
            runs={runs}
            runsLoading={runsLoading}
            selectedRunId={selectedRunId}
            onSelectedRunIdChange={setSelectedRunId}
          />
        )}
      </Flex>
    </Content>
  );
};
