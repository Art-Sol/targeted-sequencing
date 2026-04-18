/**
 * Преобразует размер в байтах в человекочитаемый формат.
 * 1024 байт = 1 KB, 1024 KB = 1 MB, 1024 MB = 1 GB.
 *
 * Math.log(bytes) / Math.log(1024) — логарифм по основанию 1024,
 * определяет "порядок" размера (0 = байты, 1 = KB, 2 = MB, 3 = GB).
 * Math.floor округляет вниз, чтобы выбрать правильную единицу.
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};
