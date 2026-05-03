import { Flex, Alert, Collapse, Progress, Typography } from 'antd';
import type { PipelineStatus as PipelineStatusType } from '../../../shared/model/types';
import classes from './PipelineStatus.module.css';

const { Text } = Typography;

// ============================================================
// PipelineStatus — визуализация состояния пайплайна
// ============================================================
//
// Ядро — круглый <Progress type="circle">. Внутри круга разный текст
// в зависимости от состояния:
//   - idle       → "Запустите анализ"
//   - running    → XX% (или "Подготовка..." если totalSamples ещё не известен)
//   - done/error → круг скрыт, снизу алерт
//
// Сам запуск анализа делает StepActions на уровне UploadPage — здесь
// только обратная связь.
// ============================================================

interface PipelineStatusProps {
  status: PipelineStatusType;
  error?: string;
  /** Сколько образцов начато обработкой (для процента прогресса) */
  samplesProcessed?: number;
  /** Всего образцов в list_reads.txt */
  totalSamples?: number;
}

const CIRCLE_SIZE = 180;

export const PipelineStatus = ({
  status,
  error,
  samplesProcessed,
  totalSamples,
}: PipelineStatusProps) => {
  const isIdle = status === 'idle';
  const isRunning = status === 'running';
  const isError = status === 'error';

  // Процент с кап'ом 95% — чтобы круг не «добегал» до 100% до фактического done
  // (после последнего bwa ещё идут sort/index/RPKM, которые мы не считаем).
  const percent =
    isRunning && totalSamples && totalSamples > 0
      ? Math.min(95, Math.round(((samplesProcessed ?? 0) / totalSamples) * 100))
      : 0;

  // Кастомный текст внутри круга. null — значит использовать дефолтный "XX%".
  const innerText: string | null = (() => {
    if (isIdle) return 'Запустите анализ';
    if (isRunning && !totalSamples) return 'Подготовка...';
    return null;
  })();

  // Круг рисуем только на стадиях, где он информативен. На done/error его
  // заменяют таблица или алерт.
  const showCircle = isIdle || isRunning;

  return (
    <Flex vertical align="center" gap={16}>
      {showCircle && (
        <Progress
          type="circle"
          size={CIRCLE_SIZE}
          percent={percent}
          status={isRunning ? 'active' : 'normal'}
          format={
            innerText
              ? () => <span className={classes.circleInnerLong}>{innerText}</span>
              : undefined
          }
        />
      )}

      {/* Дополнительный хинт под кругом — только когда реально что-то считается */}
      {isRunning && totalSamples && totalSamples > 0 && (
        <Text type="secondary">
          {(samplesProcessed ?? 0) > 0
            ? `Обрабатывается образец ${samplesProcessed} из ${totalSamples}`
            : 'Подготовка...'}
        </Text>
      )}

      {isError && error && (
        <Alert
          className={classes.errorAlert}
          type="error"
          message="Пайплайн завершился с ошибкой"
          description={
            <Collapse
              size="small"
              items={[
                {
                  key: '1',
                  label: 'Подробности ошибки',
                  children: <pre className={classes.errorDetails}>{error}</pre>,
                },
              ]}
            />
          }
        />
      )}

      {/* Alert «Анализ успешно завершён» вынесен в ResultsTable (footer таблицы)
          — чтобы быть подле результатов, как в FastqStepContent: alert валидации
          там лежит внутри Card вместе с таблицей загруженных файлов. */}
    </Flex>
  );
};
