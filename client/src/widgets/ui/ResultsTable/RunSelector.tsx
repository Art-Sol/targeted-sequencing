import { Select, Tag } from 'antd';
import type { RunInfo } from '../../../shared/model/types';
import classes from './ResultsTable.module.css';

interface RunSelectorProps {
  runs: RunInfo[];
  value?: string;
  onChange: (runId: string) => void;
  loading?: boolean;
}

/** Преобразует runId формата YYYY-MM-DD_HHmmss в DD.MM.YYYY HH:MM:SS. */
function formatRunId(runId: string): string {
  const match = runId.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return runId;
  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}`;
}

export const RunSelector = ({ runs, value, onChange, loading }: RunSelectorProps) => {
  if (runs.length === 0) return null;

  return (
    <Select
      className={classes.runSelector}
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder="Выберите запуск"
      options={runs.map((run) => ({
        value: run.runId,
        disabled: !run.hasResults,
        label: (
          <>
            {formatRunId(run.runId)}
            {!run.hasResults && (
              <Tag color="error" className={classes.runErrorTag}>
                ошибка
              </Tag>
            )}
          </>
        ),
      }))}
    />
  );
};
