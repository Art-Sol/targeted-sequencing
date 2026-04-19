import { Button, Flex, Alert, Collapse, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { runPipeline } from '../../../shared/api/client';
import type { PipelineStatus } from '../../../shared/model/types';
import { StatusBadge } from './StatusBadge';
import classes from './PipelineControls.module.css';

interface PipelineControlsProps {
  status: PipelineStatus;
  error?: string;
  onStarted: () => void;
}

export const PipelineControls = ({ status, error, onStarted }: PipelineControlsProps) => {
  const isRunning = status === 'running';

  const handleRun = async () => {
    try {
      await runPipeline();
      message.success('Анализ запущен');
      onStarted();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={12}>
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          loading={isRunning}
          disabled={isRunning}
          onClick={handleRun}
        >
          {isRunning ? 'Анализ выполняется...' : 'Запустить анализ'}
        </Button>
        <StatusBadge status={status} />
      </Flex>

      {status === 'error' && error && (
        <Alert
          type="error"
          message="Пайплайн завершился с ошибкой"
          description={
            <Collapse
              size="small"
              items={[
                {
                  key: '1',
                  label: 'Подробности ошибки',
                  children: (
                    <pre className={classes.errorDetails}>{error}</pre>
                  ),
                },
              ]}
            />
          }
        />
      )}

      {status === 'done' && (
        <Alert type="success" message="Анализ успешно завершён" showIcon />
      )}
    </Flex>
  );
};
