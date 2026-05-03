import { useState } from 'react';
import { Result, Button, Spin, Typography, Card, Flex, message } from 'antd';
import type { ReactNode } from 'react';
import type { HealthResponse } from '../../../shared/model/types';
import { retryImageLoad } from '../../../shared/api/client';
import { DockerAutoLaunchButton } from '../../../shared/ui/DockerAutoLaunchButton/DockerAutoLaunchButton';
import { DockerCustomPathInput } from '../../../shared/ui/DockerCustomPathInput/DockerCustomPathInput';
import classes from './DockerCheck.module.css';

const { Paragraph, Link } = Typography;

interface DockerCheckProps {
  health: HealthResponse | null;
  loading: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Презентационный компонент: по health-объекту решает, показать инструкцию
 * или пропустить дочерние элементы. Загрузку и retry владеет родитель.
 *
 * - loading=true              → спиннер
 * - health.docker=false       → инструкция «установите Docker»
 * - health.daemon=false       → инструкция «запустите Docker» + auto-launch + (Windows) custom path input
 * - health.image=false        → «образ пайплайна не найден»
 * - всё в порядке             → children
 */
export const DockerCheck = ({ health, loading, onRetry, children }: DockerCheckProps) => {
  // Большой спиннер показываем ТОЛЬКО при первичной загрузке (health ещё null).
  // На background-refetch (polling каждые 3 сек) loading тоже становится true,
  // но `health` уже есть — продолжаем рендерить UI на текущих данных, иначе
  // экран мерцает между «Проверка окружения…» и реальным состоянием.
  if (loading && !health) {
    return (
      <div className={classes.container}>
        <Spin size="large" tip="Проверка программного окружения..." className={classes.spinner} />
      </div>
    );
  }

  if (!health || !health.docker) {
    return (
      <div className={classes.container}>
        <Result
          status="warning"
          title="Docker не найден"
          subTitle="Для работы приложения необходим Docker"
          extra={[
            <Button type="primary" key="retry" onClick={onRetry}>
              Проверить снова
            </Button>,
          ]}
        />
        <Card>
          <Paragraph>Установите Docker для вашей операционной системы:</Paragraph>
          <Paragraph>
            <Link
              href="https://docs.docker.com/desktop/setup/install/windows-install/"
              target="_blank"
            >
              Windows
            </Link>
            {' | '}
            <Link href="https://docs.docker.com/desktop/setup/install/mac-install/" target="_blank">
              macOS
            </Link>
            {' | '}
            <Link href="https://docs.docker.com/engine/install/" target="_blank">
              Linux
            </Link>
          </Paragraph>
          <Paragraph type="secondary">
            После установки запустите Docker Desktop и нажмите &laquo;Проверить снова&raquo;.
          </Paragraph>
        </Card>
      </div>
    );
  }

  if (!health.daemon) {
    return (
      <div className={classes.container}>
        <Result
          status="warning"
          title="Docker не запущен"
          subTitle="Docker установлен, но движок Docker не активен"
          extra={
            <Flex gap={8} align="center" justify="center">
              <Button type="primary" onClick={onRetry}>
                Проверить снова
              </Button>
              <DockerAutoLaunchButton onAfterLaunch={onRetry} />
            </Flex>
          }
        />
        <Flex gap={16} vertical>
          <Card>
            <Paragraph>
              <strong>Windows / macOS:</strong> запустите приложение Docker Desktop и дождитесь его
              загрузки.
            </Paragraph>
            <Paragraph>
              <strong>Linux:</strong> выполните команду <code>sudo systemctl start docker</code>
            </Paragraph>
            <Paragraph type="secondary">
              После запуска нажмите &laquo;Проверить снова&raquo;.
            </Paragraph>
          </Card>
          <DockerCustomPathInput onAfterRetry={onRetry} />
        </Flex>
      </div>
    );
  }

  // Важно: imageLoading проверяется ДО health.image. `docker image inspect`
  // начинает возвращать success как только тег зарегистрирован — даже если
  // сам `docker load` ещё не дописал слои. Если бы мы сначала проверяли
  // `!health.image`, то на этом промежутке отрендерили бы children
  // (главный экран), а через пару секунд после завершения load — снова
  // ререндер с toast'ом. Держим спиннер пока сервер явно не скажет
  // imageLoading=false.
  if (health.imageLoading) {
    return (
      <div className={classes.container}>
        <Result
          icon={<Spin size="large" />}
          title="Загрузка Docker-образа…"
          subTitle="Это разовая операция, занимает 1-2 минуты"
        >
          <Paragraph type="secondary">
            Образ распаковывается из локального архива. Не закрывайте приложение — после завершения
            интерфейс разблокируется автоматически.
          </Paragraph>
        </Result>
      </div>
    );
  }

  if (!health.image) {
    if (health.imageLoadError) {
      return (
        <div className={classes.container}>
          <ImageLoadErrorView error={health.imageLoadError} onRetry={onRetry} />
        </div>
      );
    }
    return (
      <div className={classes.container}>
        <Result
          status="info"
          title="Docker-образ пайплайна не найден"
          subTitle="Образ targets-pipeline:0.1.0 не загружен"
          extra={[
            <Button type="primary" key="retry" onClick={onRetry}>
              Проверить снова
            </Button>,
          ]}
        >
          <Paragraph type="secondary">
            В Electron-версии образ загружается автоматически. В режиме разработки загрузите его
            вручную.
          </Paragraph>
        </Result>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * UI для случая, когда `docker load` из bundled tar упал.
 * Чаще всего — повреждённый/неполный tar.gz. Юзер заменяет файл и нажимает
 * «Попробовать заново» — endpoint сбрасывает error и запускает новую попытку.
 */
const ImageLoadErrorView = ({ error, onRetry }: { error: string; onRetry: () => void }) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryImageLoad();
      message.info('Загрузка образа запущена');
      onRetry();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось запустить загрузку');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Result
      status="error"
      title="Не удалось загрузить Docker-образ"
      subTitle="Чаще всего это значит, что архив повреждён или скачан не полностью"
      extra={
        <Button type="primary" loading={retrying} onClick={handleRetry}>
          Попробовать заново
        </Button>
      }
    >
      <Card>
        <Paragraph type="secondary">Текст ошибки от Docker:</Paragraph>
        <pre style={{ background: '#f4f4f4', padding: 12, borderRadius: 4, overflow: 'auto' }}>
          {error}
        </pre>
        <Paragraph type="secondary">
          Замените файл архива и нажмите &laquo;Попробовать заново&raquo;.
        </Paragraph>
      </Card>
    </Result>
  );
};
