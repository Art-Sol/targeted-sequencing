import { useState } from 'react';
import { Upload, Card, Alert, Typography, List, message, Flex } from 'antd';
import { InboxOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { StepActions } from './StepActions';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { uploadReadsList, uploadSingleFastq, cleanUploads } from '../../../shared/api/client';
import type {
  UploadedFileInfo,
  UploadStatusResponse,
  ValidationResult,
  ReadsListEntry,
} from '../../../shared/model/types';
import { formatBytes } from '../../../shared/lib/format/formatBytes';

const { Dragger } = Upload;
const { Text } = Typography;

interface FileUploadProps {
  currentStep: number;
  status: UploadStatusResponse | null;
  validation: ValidationResult | null;
  entries: ReadsListEntry[];
  onReadsListUploaded: (entries: ReadsListEntry[]) => void;
  onFastqUploaded: () => void;
  onCleaned: () => void;
  onProcessingChange: (processing: boolean) => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

export const FileUpload = ({
  currentStep,
  status,
  validation,
  entries,
  onReadsListUploaded,
  onFastqUploaded,
  onCleaned,
  onProcessingChange,
  onStepBack,
  onStepForward,
}: FileUploadProps) => {
  const [loading, setLoading] = useState(false);

  // ------- Обработчики загрузки -------

  const handleReadsListUpload = async (options: UploadRequestOption) => {
    const { file, onProgress, onSuccess, onError } = options;
    onProcessingChange(true);

    try {
      const result = await uploadReadsList(file as File, (percent) => {
        onProgress?.({ percent });
      });

      onSuccess?.(result);
      message.success('Файл описания образцов загружен');
      onReadsListUploaded(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка загрузки';
      onError?.(new Error(errorMsg));
      message.error(errorMsg);
    } finally {
      onProcessingChange(false);
    }
  };

  const expectedFiles = new Set(
    entries.flatMap((e) => e.fastqPaths.map((p) => p.split('/').pop())),
  );

  const handleFastqUpload = async (options: UploadRequestOption) => {
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
      const result = await uploadSingleFastq(file as File, (percent) => {
        onProgress?.({ percent });
      });

      onSuccess?.(result);
      onFastqUploaded();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка загрузки';
      onError?.(new Error(errorMsg));
      message.error(errorMsg);
    } finally {
      onProcessingChange(false);
    }
  };

  // ------- Очистка файлов -------

  const handleClean = async () => {
    setLoading(true);

    try {
      await cleanUploads();
      message.success('Файлы удалены');
      onCleaned();
    } catch {
      message.error('Не удалось очистить файлы');
    } finally {
      setLoading(false);
    }
  };

  // ------- Рендер -------

  return (
    <Flex vertical justify="center" gap="small">
      {/* Предупреждение о нехватке места на диске */}
      {status?.diskWarning && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Мало свободного места на диске"
          description={`Свободно: ${formatBytes(status.diskFreeBytes)}. Рекомендуем очистить место для загрузки новых файлов.`}
        />
      )}

      {/* ===== Шаг 1: Загрузка list_reads.txt ===== */}
      {currentStep === 0 && entries.length === 0 && (
        <Card size="small">
          <Dragger name="file" maxCount={1} accept=".txt" customRequest={handleReadsListUpload}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Перетащите файл описания образцов или нажмите для выбора
            </p>
            <p className="ant-upload-hint">
              TSV-файл с описанием образцов (sample_id, тип, пути к FASTQ)
            </p>
          </Dragger>
        </Card>
      )}

      {/* Шаг 1: файл уже загружен — показываем результат */}
      {currentStep === 0 && entries.length > 0 && (
        <Card title="Файл описания загружен" size="small">
          <List
            size="small"
            header={<Text type="secondary">Найдено образцов: {entries.length}</Text>}
            dataSource={entries}
            renderItem={(entry) => (
              <List.Item>
                <Text code>{entry.sampleId}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {entry.mode === 'se' ? 'single-end' : 'paired-end'}
                  {' — '}
                  {entry.fastqPaths.map((p) => p.split('/').pop()).join(', ')}
                </Text>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Кнопки навигации шага 1 */}
      {currentStep === 0 && entries.length > 0 && (
        <StepActions
          onForward={onStepForward}
          onClean={handleClean}
          cleanLoading={loading}
          confirmTitle="Загрузить другой файл?"
          confirmDescription="Текущий файл и все FASTQ будут удалены"
          cleanLabel="Загрузить заново"
        />
      )}

      {/* ===== Шаг 2: Загрузка FASTQ-файлов ===== */}
      {currentStep === 1 && (
        <>
          {/* Статус загруженных файлов */}
          {status && status.fastqFiles.length > 0 && (
            <Card title="Загруженные FASTQ-файлы" size="small">
              <List
                size="small"
                dataSource={status.fastqFiles}
                renderItem={(file: UploadedFileInfo) => (
                  <List.Item>
                    <Text>{file.name}</Text>
                    <Text type="secondary">{formatBytes(file.size)}</Text>
                  </List.Item>
                )}
              />

              {/* Результат валидации */}
              {validation && (
                <div style={{ marginTop: 12 }}>
                  {validation.valid ? (
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
                  ) : null}
                </div>
              )}
            </Card>
          )}

          {/* Зона загрузки FASTQ */}
          {!validation?.valid && (
            <Card size="small">
              <Dragger
                name="files"
                multiple
                accept=".fastq,.fastq.gz,.fq,.fq.gz"
                customRequest={handleFastqUpload}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Перетащите FASTQ-файлы или нажмите для выбора</p>
                <p className="ant-upload-hint">
                  Поддерживаемые форматы: .fastq, .fastq.gz, .fq, .fq.gz
                </p>
              </Dragger>
            </Card>
          )}

          {/* Кнопки: назад + очистка */}
          <StepActions
            onBack={onStepBack}
            onClean={handleClean}
            cleanLoading={loading}
            confirmTitle="Удалить все загруженные файлы?"
            confirmDescription="Это действие нельзя отменить"
            cleanLabel="Очистить файлы"
          />
        </>
      )}
    </Flex>
  );
};
