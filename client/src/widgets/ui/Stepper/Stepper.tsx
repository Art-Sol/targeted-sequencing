import { Steps } from 'antd';
import { FC } from 'react';
import { Step } from '../../../pages/module/types';
import { PipelineStatus, ReadsListEntry, ValidationResult } from '../../../shared/model/types';
import { FileTextOutlined, ProfileOutlined, TableOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import classes from './Stepper.module.css';
const { Text } = Typography;

type StepStatus = 'current' | 'finish' | 'wait' | 'process';
type IconComponent = typeof ProfileOutlined | typeof FileTextOutlined | typeof TableOutlined;

interface StepperProps {
  currentStep: number;
  steps: Step[];
  processing: boolean;
  entries: ReadsListEntry[];
  validation: ValidationResult | null;
  /** Статус пайплайна — нужен, чтобы шаг "Таблица" подсвечивать как finish после done */
  pipelineStatus: PipelineStatus;
}

const COLORS_MAP: Partial<Record<StepStatus, string>> = {
  current: '#87b9ff', // синий
  finish: '#1677ff', // зеленый
};

const ICONS: IconComponent[] = [ProfileOutlined, FileTextOutlined, TableOutlined];

export const Stepper: FC<StepperProps> = ({
  currentStep,
  steps,
  processing,
  entries,
  validation,
  pipelineStatus,
}) => {
  // ------- Статус шагов для Steps -------
  const getStepStatus = (stepIndex: number) => {
    // Во время загрузки/парсинга — показываем "в процессе"
    if (processing && stepIndex === currentStep) return 'process';

    switch (stepIndex) {
      // Шаг 1: finish только если файл загружен и распарсен
      case 0:
        return entries.length > 0 ? 'finish' : 'wait';
      // Шаг 2: finish только если все FASTQ-файлы загружены
      case 1:
        return validation?.valid ? 'finish' : 'wait';
      // Шаг 3: finish после успешного завершения пайплайна.
      case 2:
        return pipelineStatus === 'done' ? 'finish' : 'wait';
      default:
        return 'wait';
    }
  };

  return (
    <Steps
      current={currentStep}
      items={steps.map((s, i) => {
        const stepStatus = getStepStatus(i);
        const isCurrentWait = stepStatus === 'wait' && i === currentStep;

        const color = isCurrentWait ? COLORS_MAP.current : COLORS_MAP[stepStatus];

        const IconComponent = ICONS[i] as IconComponent;

        return {
          title: (
            <Text
              strong
              className={i === currentStep ? classes.currentTitle : undefined}
              style={color ? { color } : undefined}
            >
              {s.title}
            </Text>
          ),
          icon: <IconComponent style={color ? { color } : undefined} />,
          status: stepStatus,
        };
      })}
    />
  );
};
