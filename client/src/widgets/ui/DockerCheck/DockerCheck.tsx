import { Result, Button, Spin, Typography, Card } from 'antd';
import type { ReactNode } from 'react';
import type { HealthResponse } from '../../../shared/model/types';
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
 * - health.daemon=false       → инструкция «запустите Docker»
 * - health.image=false        → «образ пайплайна не найден»
 * - всё в порядке             → children
 */
export const DockerCheck = ({ health, loading, onRetry, children }: DockerCheckProps) => {
  if (loading) {
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
          extra={[
            <Button type="primary" key="retry" onClick={onRetry}>
              Проверить снова
            </Button>,
          ]}
        />
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
      </div>
    );
  }

  if (!health.image) {
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
