import { useState } from 'react';
import { Button, message } from 'antd';

/**
 * Кнопка «Попробовать запустить программно» — обращается через preload-мост
 * к Electron main process, который пробует поднять Docker Desktop по цепочке
 * методов (customPath → ProgramFiles → shell на Windows; `open -a Docker` на macOS).
 *
 * Видна только на платформах с реализованным auto-launch'ем:
 *   - Windows
 *   - macOS
 * На Linux и в browser-dev режиме (`window.electronAPI` отсутствует) — null.
 */
const AUTO_LAUNCH_PLATFORMS = ['win32', 'darwin'] as const;

interface DockerAutoLaunchButtonProps {
  /** Колбэк после попытки запуска — обычно refetch /api/health на родителе. */
  onAfterLaunch: () => void;
}

export const DockerAutoLaunchButton = ({ onAfterLaunch }: DockerAutoLaunchButtonProps) => {
  const electronAPI = window.electronAPI;
  const [launching, setLaunching] = useState(false);

  if (
    !electronAPI ||
    !AUTO_LAUNCH_PLATFORMS.includes(electronAPI.platform as (typeof AUTO_LAUNCH_PLATFORMS)[number])
  ) {
    return null;
  }

  const handleClick = async () => {
    setLaunching(true);
    try {
      const result = await electronAPI.retryDockerLaunch();
      if (result.daemonUp) {
        message.success('Docker запущен');
      } else {
        message.warning('Не удалось запустить Docker — проверьте установку');
      }
      onAfterLaunch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Ошибка запуска Docker');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Button onClick={handleClick} loading={launching}>
      Попробовать запустить программно
    </Button>
  );
};
