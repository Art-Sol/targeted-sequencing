import { Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadRequestOption } from 'rc-upload/lib/interface';

const { Dragger } = Upload;

// ============================================================
// FileUpload — drag-and-drop зона загрузки
// ============================================================
//
// Тонкая обёртка над Ant Design Upload.Dragger. Её единственная
// ответственность — визуал drop-zone и проброс кастомного
// обработчика загрузки (customRequest) наружу.
//
// Бизнес-логика (что именно делать с файлом, куда его слать,
// как реагировать на успех/ошибку, обновление прогресса) — ответственность
// вызывающего кода (step-content'ов в pages/ui/steps/).
// ============================================================

interface FileUploadProps {
  /** name-атрибут input — важен для правильного multipart-form */
  name: string;
  /** Список допустимых расширений/MIME: '.txt', '.fastq,.fastq.gz,.fq,.fq.gz' */
  accept: string;
  /** Разрешить выбор нескольких файлов за раз (для FASTQ) */
  multiple?: boolean;
  /** Максимум файлов в одной сессии выбора (например 1 для list_reads.txt) */
  maxCount?: number;
  /** Основной текст в зоне */
  title: string;
  /** Подсказка под заголовком */
  hint: string;
  /**
   * Кастомный обработчик загрузки. Вызывается для каждого файла;
   * получает объект с File и колбэками onProgress/onSuccess/onError.
   */
  customRequest: (options: UploadRequestOption) => void | Promise<void>;
}

export const FileUpload = ({
  name,
  accept,
  multiple,
  maxCount,
  title,
  hint,
  customRequest,
}: FileUploadProps) => (
  <Dragger
    name={name}
    accept={accept}
    multiple={multiple}
    maxCount={maxCount}
    customRequest={customRequest}
  >
    <p className="ant-upload-drag-icon">
      <InboxOutlined />
    </p>
    <p className="ant-upload-text">{title}</p>
    <p className="ant-upload-hint">{hint}</p>
  </Dragger>
);
