import { Tag } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { PipelineStatus } from '../../../shared/model/types';

interface StatusBadgeProps {
  status: PipelineStatus;
}

interface StatusConfig {
  color: string;
  label: string;
  icon: React.ReactNode;
}

const STATUS_CONFIG: Record<PipelineStatus, StatusConfig> = {
  idle: { color: 'default', label: 'Ожидание', icon: <ClockCircleOutlined /> },
  running: { color: 'processing', label: 'Анализ выполняется...', icon: <LoadingOutlined /> },
  done: { color: 'success', label: 'Анализ завершён', icon: <CheckCircleOutlined /> },
  error: { color: 'error', label: 'Ошибка', icon: <CloseCircleOutlined /> },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  return (
    <Tag color={config.color} icon={config.icon}>
      {config.label}
    </Tag>
  );
};
