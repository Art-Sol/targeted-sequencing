import { useEffect, useState } from 'react';
import { Button, Card, Input, Space, Typography, message } from 'antd';

const { Paragraph } = Typography;

/**
 * Windows-only: позволяет указать путь к Docker Desktop.exe вручную, если
 * автоматический поиск (ProgramFiles, App Paths registry) промахнулся.
 *
 * - Не рендерится в browser-dev (нет electronAPI) и на не-Windows платформах
 * - Загружает ранее сохранённый путь при монтировании (предзаполнение)
 * - На save: персистит путь → вызывает retryDockerLaunch → onAfterRetry (refetch health)
 */
interface DockerCustomPathInputProps {
  onAfterRetry: () => void;
}

export const DockerCustomPathInput = ({ onAfterRetry }: DockerCustomPathInputProps) => {
  const electronAPI = window.electronAPI;
  const [customPath, setCustomPath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!electronAPI || electronAPI.platform !== 'win32') return;
    electronAPI.getDockerCustomPath().then((p) => {
      if (p) setCustomPath(p);
    });
  }, [electronAPI]);

  if (!electronAPI || electronAPI.platform !== 'win32') return null;

  const handleSave = async () => {
    if (!customPath.trim()) {
      message.warning('Укажите путь к Docker Desktop.exe');
      return;
    }
    setSaving(true);
    try {
      await electronAPI.setDockerCustomPath(customPath.trim());
      const result = await electronAPI.retryDockerLaunch();
      if (result.daemonUp) {
        message.success('Docker запущен');
      } else {
        message.warning('Docker всё ещё не отвечает — проверьте путь');
      }
      onAfterRetry();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Ошибка сохранения пути');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Указать путь к Docker Desktop вручную">
      <Paragraph type="secondary">
        Если Docker установлен в нестандартное место — укажите полный путь к{' '}
        <code>Docker Desktop.exe</code>. Программа запомнит и будет использовать его при следующих
        запусках.
      </Paragraph>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="C:\Program Files\Docker\Docker\Docker Desktop.exe"
          value={customPath}
          onChange={(e) => setCustomPath(e.target.value)}
          disabled={saving}
        />
        <Button type="primary" loading={saving} onClick={handleSave}>
          Сохранить и попробовать
        </Button>
      </Space.Compact>
    </Card>
  );
};
