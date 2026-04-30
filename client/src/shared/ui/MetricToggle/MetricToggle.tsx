import { Switch } from 'antd';
import type { MetricType } from '../../model/types';

interface MetricToggleProps {
  value: MetricType;
  onChange: (value: MetricType) => void;
}

// ============================================================
// MetricToggle — переключатель отображаемой метрики
// ============================================================
//
// Два режима:
// - Mapped Reads — сырое число ридов, картируемых на таргет.
//   Удобно для сравнения «чего сколько попало» в рамках одного образца.
// - RPKM — reads per kilobase per million. Нормализованное значение,
//   учитывает длину таргета и общий объём библиотеки. Сравнимо МЕЖДУ образцами.
//
// Switch использует RPKM=checked, Mapped Reads=unchecked.
// ============================================================

export const MetricToggle = ({ value, onChange }: MetricToggleProps) => (
  <Switch
    checked={value === 'rpkm'}
    onChange={(checked) => onChange(checked ? 'rpkm' : 'mapped_reads')}
    checkedChildren="RPKM"
    unCheckedChildren="Mapped Reads"
  />
);
