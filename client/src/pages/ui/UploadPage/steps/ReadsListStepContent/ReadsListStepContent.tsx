import { Card, Table, Typography, message, Flex, Alert, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { uploadReadsList } from '../../../../../shared/api/client';
import type { ReadsListEntry, UploadStatusResponse } from '../../../../../shared/model/types';
import { formatBytes } from '../../../../../shared/lib/format/formatBytes';
import { FileUpload } from '../../../../../widgets';

const { Text } = Typography;

// ============================================================
// Шаг 1 (currentStep=0): загрузка list_reads.txt
// ============================================================
//
// Компонент отвечает ТОЛЬКО за контент шага: drop-zone или таблица
// уже распарсенных записей. Навигация (Далее / Удалить) рендерится
// отдельно через StepActions на уровне UploadPage.
// ============================================================

interface ReadsListStepContentProps {
  status: UploadStatusResponse | null;
  entries: ReadsListEntry[];
  onReadsListUploaded: (entries: ReadsListEntry[]) => void;
  onProcessingChange: (processing: boolean) => void;
}

const columns: TableColumnsType<ReadsListEntry> = [
  {
    title: 'Образец',
    dataIndex: 'sampleId',
    key: 'sampleId',
    width: 200,
    render: (sampleId: string) => <Text>{sampleId}</Text>,
  },
  {
    title: 'Режим',
    dataIndex: 'mode',
    key: 'mode',
    width: 140,
    render: (mode: ReadsListEntry['mode']) =>
      mode === 'se' ? <Tag color="blue">single-end</Tag> : <Tag color="green">paired-end</Tag>,
  },
  {
    title: 'FASTQ-файлы',
    dataIndex: 'fastqPaths',
    key: 'fastqPaths',
    render: (paths: string[]) => paths.map((p) => p.split('/').pop()).join(', '),
  },
];

export const ReadsListStepContent = ({
  status,
  entries,
  onReadsListUploaded,
  onProcessingChange,
}: ReadsListStepContentProps) => {
  const handleUpload = async (options: UploadRequestOption) => {
    const { file, onProgress, onSuccess, onError } = options;
    onProcessingChange(true);
    try {
      const result = await uploadReadsList(file as File, (percent) => onProgress?.({ percent }));
      onSuccess?.(result);
      message.success('Файл описания образцов загружен');
      onReadsListUploaded(result);
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

      {entries.length === 0 ? (
        <Card size="small">
          <FileUpload
            name="file"
            accept=".txt"
            maxCount={1}
            title="Перетащите файл описания образцов или нажмите для выбора"
            hint="TSV-файл с описанием образцов (sample_id, тип, пути к FASTQ)"
            customRequest={handleUpload}
          />
        </Card>
      ) : (
        <Card title="Загруженный файл описания образцов" size="small">
          <Table<ReadsListEntry>
            dataSource={entries}
            columns={columns}
            rowKey="sampleId"
            pagination={false}
            bordered
            size="small"
            footer={() => `Найдено образцов: ${entries.length}`}
          />
        </Card>
      )}
    </Flex>
  );
};
