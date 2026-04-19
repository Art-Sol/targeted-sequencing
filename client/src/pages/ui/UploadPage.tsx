import { useState, useEffect, useCallback } from 'react';
import { Typography, Layout, Flex } from 'antd';
import { getUploadStatus } from '../../shared/api/client';
import type {
  UploadStatusResponse,
  ValidationResult,
  ReadsListEntry,
} from '../../shared/model/types';
import { STEPS } from '../module/consts';

import classes from './UploadPage.module.css';
import { Step } from '../module/types';
import { FileUpload, Stepper, PipelineControls } from '../../widgets';
import { usePipelineStatus } from '../../shared/hooks/usePipelineStatus';

const { Title, Paragraph } = Typography;
const { Content } = Layout;

export const UploadPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<UploadStatusResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [entries, setEntries] = useState<ReadsListEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const pipeline = usePipelineStatus();

  // ------- Получение статуса с сервера -------

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getUploadStatus();
      setStatus(data);
      setValidation(data.validation);
      if (data.validation.entries.length > 0) {
        setEntries(data.validation.entries);
      }
    } catch {
      // Сервер недоступен
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ------- Колбэки для FileUpload -------

  const handleReadsListUploaded = (newEntries: ReadsListEntry[]) => {
    setEntries(newEntries);
    refreshStatus();
  };

  const handleFastqUploaded = () => {
    refreshStatus();
  };

  const handleCleaned = () => {
    setStatus(null);
    setValidation(null);
    setEntries([]);
    setCurrentStep(0);
    refreshStatus();
  };

  const step = STEPS[currentStep] as Step;

  return (
    <Content className={classes.content}>
      <Stepper
        currentStep={currentStep}
        steps={STEPS}
        processing={processing}
        entries={entries}
        validation={validation}
      />
      <Flex vertical justify="center" className={classes.stepContent}>
        <Title level={4}>{step.stepTitle}</Title>
        <Paragraph type="secondary" className={classes.stepDescription}>
          {step.stepDescription}
        </Paragraph>
        <FileUpload
          currentStep={currentStep}
          status={status}
          validation={validation}
          entries={entries}
          onReadsListUploaded={handleReadsListUploaded}
          onFastqUploaded={handleFastqUploaded}
          onCleaned={handleCleaned}
          onProcessingChange={setProcessing}
          onStepBack={() => setCurrentStep(0)}
          onStepForward={() => setCurrentStep(1)}
        />

        {currentStep === 1 && validation?.valid && (
          <PipelineControls
            status={pipeline.status}
            error={pipeline.error}
            onStarted={pipeline.refresh}
          />
        )}
      </Flex>
    </Content>
  );
};
