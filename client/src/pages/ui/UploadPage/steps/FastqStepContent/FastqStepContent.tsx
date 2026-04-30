import { useMemo } from 'react';
import { Card, Table, Alert, message, Flex } from 'antd';
import type { TableColumnsType } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { uploadSingleFastq } from '../../../../../shared/api/client';
import type {
  UploadedFileInfo,
  UploadStatusResponse,
  ValidationResult,
  ReadsListEntry,
} from '../../../../../shared/model/types';
import { formatBytes } from '../../../../../shared/lib/format/formatBytes';
import { FileUpload } from '../../../../../widgets';

const fastqColumns: TableColumnsType<UploadedFileInfo> = [
  {
    title: 'Файл',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Размер',
    dataIndex: 'size',
    key: 'size',
    width: 140,
    align: 'right',
    render: (size: number) => formatBytes(size),
  },
];

// ============================================================
// Шаг 2 (currentStep=1): загрузка FASTQ-файлов
// ============================================================
//
// Только контент шага: список загруженного, drop-zone для недостающих,
// результат валидации. Навигация (Назад / Далее / Удалить) рендерится
// на уровне UploadPage через StepActions.
// ============================================================

interface FastqStepContentProps {
  status: UploadStatusResponse | null;
  validation: ValidationResult | null;
  entries: ReadsListEntry[];
  onFastqUploaded: () => void;
  onProcessingChange: (processing: boolean) => void;
}

export const FastqStepContent = ({
  status,
  validation,
  entries,
  onFastqUploaded,
  onProcessingChange,
}: FastqStepContentProps) => {
  // Имена FASTQ, ожидаемые пайплайном согласно list_reads.txt.
  // Мемо — чтобы Set не пересоздавался на каждый рендер.
  const expectedFiles = useMemo(
    () => new Set(entries.flatMap((e) => e.fastqPaths.map((p) => p.split('/').pop()))),
    [entries],
  );

  const handleUpload = async (options: UploadRequestOption) => {
    const { file, onProgress, onSuccess, onError } = options;
    const fileName = (file as File).name;

    if (!expectedFiles.has(fileName)) {
      const err = new Error(`Файл «${fileName}» не указан в списке образцов`);
      onError?.(err);
      message.warning(`Файл «${fileName}» не ожидается и не будет загружен`);
      return;
    }

    onProcessingChange(true);
    try {
      const result = await uploadSingleFastq(file as File, (percent) => onProgress?.({ percent }));
      onSuccess?.(result);
      onFastqUploaded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки';
      onError?.(new Error(msg));
      message.error(msg);
    } finally {
      onProcessingChange(false);
    }
  };

  return (
    <Flex vertical gap="small">
      {status?.diskWarning && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Мало свободного места на диске"
          description={`Свободно: ${formatBytes(status.diskFreeBytes)}. Рекомендуем очистить место для загрузки новых файлов.`}
        />
      )}

      {status && status.fastqFiles.length > 0 && (
        <Card title="Загруженные FASTQ-файлы" size="small">
          <Table<UploadedFileInfo>
            dataSource={status.fastqFiles}
            columns={fastqColumns}
            rowKey="name"
            pagination={false}
            bordered
            size="small"
            footer={() => {
              return (
                validation &&
                (validation.valid ? (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                    message="Все FASTQ-файлы загружены"
                  />
                ) : validation.missingFiles.length > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Не хватает FASTQ-файлов"
                    description={validation.missingFiles.join(', ')}
                  />
                ) : null)
              );
            }}
          />
        </Card>
      )}

      {!validation?.valid && (
        <Card size="small">
          <FileUpload
            name="files"
            accept=".fastq,.fastq.gz,.fq,.fq.gz"
            multiple
            title="Перетащите FASTQ-файлы или нажмите для выбора"
            hint="Поддерживаемые форматы: .fastq, .fastq.gz, .fq, .fq.gz"
            customRequest={handleUpload}
          />
        </Card>
      )}
    </Flex>
  );
};
