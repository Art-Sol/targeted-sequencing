// ============================================================
// downloadFile — программное скачивание файла из браузера
// ============================================================

/**
 * Инициирует скачивание файла с заданным содержимым и именем.
 *
 * @param content   — содержимое файла (строка)
 * @param filename  — имя, которое будет предложено пользователю
 * @param mimeType  — MIME-тип, например 'text/csv;charset=utf-8'
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    // Освобождаем object URL: иначе Blob висит в памяти до закрытия
    // вкладки. На больших файлах это не безобидно.
    URL.revokeObjectURL(url);
  }
}
