import { Button, Popconfirm, Space } from 'antd';
import { DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { FC } from 'react';

interface StepActionsProps {
  onBack?: () => void;
  onForward?: () => void;
  onClean: () => void;
  cleanLoading: boolean;
  confirmTitle: string;
  confirmDescription: string;
  cleanLabel: string;
}

export const StepActions: FC<StepActionsProps> = ({
  onBack,
  onForward,
  onClean,
  cleanLoading,
  confirmTitle,
  confirmDescription,
  cleanLabel,
}) => (
  <Space>
    {onForward && (
      <Button type="primary" icon={<ArrowRightOutlined />} onClick={onForward}>
        Далее
      </Button>
    )}
    {onBack && (
      <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
        Назад
      </Button>
    )}
    <Popconfirm
      title={confirmTitle}
      description={confirmDescription}
      onConfirm={onClean}
      okText="Да"
      cancelText="Отмена"
    >
      <Button danger icon={<DeleteOutlined />} loading={cleanLoading}>
        {cleanLabel}
      </Button>
    </Popconfirm>
  </Space>
);
