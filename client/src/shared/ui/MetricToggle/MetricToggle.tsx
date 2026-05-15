import { Radio, type RadioChangeEvent } from 'antd';
import type { MetricType } from '../../model/types';

interface MetricToggleProps {
  value: MetricType;
  onChange: (value: MetricType) => void;
}

// ============================================================
// MetricToggle — переключатель отображаемой метрики
// ============================================================
//
// Три режима:
// - Mapped Reads — сырое число ридов, картируемых на таргет.
//   Удобно для сравнения «чего сколько попало» в рамках одного образца.
// - RPKM — reads per kilobase per million. Нормализованное значение,
//   учитывает длину таргета и общий объём библиотеки. Сравнимо МЕЖДУ образцами.
// - Presence — бинарный флаг 0/1: обнаружен ли таргет.
//   1 если mapped_reads ≥ индивидуальный presence_threshold таргета.
// ============================================================

const OPTIONS: { label: string; value: MetricType }[] = [
  { label: 'Presence', value: 'presence' },
  { label: 'Mapped Reads', value: 'mapped_reads' },
  { label: 'RPKM', value: 'rpkm' },
];

export const MetricToggle = ({ value, onChange }: MetricToggleProps) => (
  <Radio.Group
    value={value}
    onChange={(e: RadioChangeEvent) => onChange(e.target.value as MetricType)}
    options={OPTIONS}
    optionType="button"
    buttonStyle="solid"
  />
);
