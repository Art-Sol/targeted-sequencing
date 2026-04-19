import { Result, Button, Spin, Typography, Card } from 'antd';
import { useState, useEffect } from 'react';
import { checkHealth } from '../../../shared/api/client';
import type { HealthResponse } from '../../../shared/model/types';
import classes from './DockerCheck.module.css';

const { Paragraph, Link } = Typography;

interface DockerCheckProps {
  children: React.ReactNode;
}

/**
 * Обёртка, которая проверяет Docker-окружение при старте приложения.
 *
 * - Docker не установлен → экран с инструкцией по установке
 * - Docker не запущен    → экран с инструкцией по запуску
 * - Образ не загружен    → экран с сообщением (в Electron автозагрузка)
 * - Всё в порядке        → показываем основной интерфейс (children)
 */
export const DockerCheck = ({ children }: DockerCheckProps) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    try {
      const result = await checkHealth();
      setHealth(result);
    } catch {
      setHealth({
        status: 'error',
        docker: false,
        daemon: false,
        image: false,
        message: 'Сервер недоступен',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  if (loading) {
    return (
      <div className={classes.container}>
        <Spin
          size="large"
          tip="Проверка программного окружения..."
          className={classes.spinner}
        />
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
            <Button type="primary" key="retry" onClick={check}>
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
            <Button type="primary" key="retry" onClick={check}>
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
            <Button type="primary" key="retry" onClick={check}>
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
