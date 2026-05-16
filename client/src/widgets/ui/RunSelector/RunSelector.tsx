import { Select, Tag, Button, Flex, Divider, Modal } from 'antd';
import type { SelectProps } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ReactNode, MouseEvent } from 'react';
import type { RunInfo } from '../../../shared/model/types';
import classes from './RunSelector.module.css';

interface RunSelectorProps {
  runs: RunInfo[];
  value?: string;
  onChange: (runId: string) => void;
  loading?: boolean;
  /** Если задан — рядом с каждым запуском появляется иконка удаления. */
  onDeleteRun?: (runId: string) => void | Promise<void>;
  /** Если задан — в подвале dropdown'а появляется кнопка «Удалить всё». */
  onDeleteAll?: () => void | Promise<void>;
}

/** Преобразует runId формата YYYY-MM-DD_HHmmss в DD.MM.YYYY HH:MM:SS. */
function formatRunId(runId: string): string {
  const match = runId.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return runId;
  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}`;
}

/** Останавливает всплытие клика, чтобы Select не выбрал опцию при клике по корзине. */
function stopOptionEvents(e: MouseEvent) {
  e.stopPropagation();
}

export const RunSelector = ({
  runs,
  value,
  onChange,
  loading,
  onDeleteRun,
  onDeleteAll,
}: RunSelectorProps) => {
  if (runs.length === 0) return null;

  const confirmDeleteOne = (run: RunInfo) => {
    if (!onDeleteRun) return;
    Modal.confirm({
      title: 'Удалить этот запуск?',
      content: `${run.name} (${formatRunId(run.runId)})`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: () => onDeleteRun(run.runId),
    });
  };

  const confirmDeleteAll = () => {
    if (!onDeleteAll) return;
    Modal.confirm({
      title: `Удалить все ${runs.length} запусков?`,
      content: 'Это освободит место на диске. Действие нельзя отменить.',
      okText: 'Удалить всё',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: () => onDeleteAll(),
    });
  };

  const renderDropdown = onDeleteAll
    ? (menu: ReactNode) => (
        <>
          {menu}
          <Divider className={classes.divider} />
          <div className={classes.dropdownFooter}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              block
              onClick={confirmDeleteAll}
              onMouseDown={stopOptionEvents}
            >
              Удалить все запуски
            </Button>
          </div>
        </>
      )
    : undefined;

  // Рендер опции в выпадающем списке: имя крупно, дата мелким шрифтом ниже.
  // В свёрнутом Select показывается простой `label` (одна строка «имя — дата»)
  // — это поведение AntD по умолчанию: optionRender применяется только в
  // раскрытом dropdown'e.
  const optionRender: SelectProps['optionRender'] = (option) => {
    const run = runs.find((r) => r.runId === option.value);
    if (!run) return option.label;
    return (
      <Flex justify="space-between" align="center" gap={8} className={classes.optionLabel}>
        <Flex vertical gap={2} className={classes.optionInfo}>
          <Flex align="center" gap={4} className={classes.optionNameRow}>
            <span className={classes.optionName}>{run.name}</span>
            {!run.hasResults && (
              <Tag color="error" className={classes.runErrorTag}>
                ошибка
              </Tag>
            )}
          </Flex>
          <span className={classes.optionDate}>{formatRunId(run.runId)}</span>
        </Flex>
        {onDeleteRun && (
          <Button
            size="small"
            icon={<DeleteOutlined className={classes.deleteIcon} />}
            onClick={(e) => {
              stopOptionEvents(e);
              confirmDeleteOne(run);
            }}
            onMouseDown={stopOptionEvents}
          />
        )}
      </Flex>
    );
  };

  return (
    <Select
      className={classes.runSelector}
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder="Выберите запуск"
      popupRender={renderDropdown}
      optionRender={optionRender}
      options={runs.map((run) => ({
        value: run.runId,
        disabled: !run.hasResults,
        label: `${run.name} — ${formatRunId(run.runId)}`,
      }))}
    />
  );
};
