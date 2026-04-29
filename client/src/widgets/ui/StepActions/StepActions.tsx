import { Button, Flex, Popconfirm } from 'antd';
import { DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { FC, ReactNode } from 'react';

// ============================================================
// StepActions — кнопки навигации и действия шага
// ============================================================
//
// Порядок отрисовки фиксированный: Назад → Далее → {custom} → Удалить.
// Custom-кнопки (children) вставляются между стандартной навигацией
// и «опасной» очисткой — туда идут primary-действия конкретного шага
// (например, «Запустить анализ» на шаге 3).
// ============================================================

interface StepActionsProps {
  onBack?: () => void;
  onForward?: () => void;
  onClean: () => void;
  cleanLoading: boolean;
  /**
   * Отключить кнопку «Удалить» (например, когда нет файлов на удаление).
   * Кроме disabled самого Button, отключаем и Popconfirm — иначе при
   * наличии текста на кнопке popconfirm мог бы открыться по клавише/касанию.
   */
  cleanDisabled?: boolean;
  confirmTitle: string;
  confirmDescription: string;
  cleanLabel: string;
  /** Доп. кнопки шага (например, «Запустить анализ»). Вставляются между «Далее» и «Удалить». */
  children?: ReactNode;
}

export const StepActions: FC<StepActionsProps> = ({
  onBack,
  onForward,
  onClean,
  cleanLoading,
  cleanDisabled,
  confirmTitle,
  confirmDescription,
  cleanLabel,
  children,
}) => (
  <Flex gap={8} justify="space-between">
    <Flex gap={8}>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} disabled={!onBack}>
        Назад
      </Button>
      <Button
        type="primary"
        icon={<ArrowRightOutlined />}
        onClick={onForward}
        disabled={!onForward}
      >
        Далее
      </Button>
      {children}
    </Flex>
    <Popconfirm
      disabled={cleanDisabled}
      title={confirmTitle}
      description={confirmDescription}
      onConfirm={onClean}
      okText="Да"
      cancelText="Отмена"
    >
      <Button danger icon={<DeleteOutlined />} loading={cleanLoading} disabled={cleanDisabled}>
        {cleanLabel}
      </Button>
    </Popconfirm>
  </Flex>
);
