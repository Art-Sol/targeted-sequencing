import { Layout, Typography, Flex } from 'antd';
import type { ReactNode } from 'react';

import classes from './layout.module.css';

const { Header } = Layout;
const { Title } = Typography;

interface AppLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
}

export const AppLayout = ({ children, headerActions }: AppLayoutProps) => {
  return (
    <Layout className={classes.layout}>
      <Header className={classes.header}>
        <Flex align="center" justify="space-between" className={classes.headerContent}>
          <Title level={4} className={classes.title}>
            Таргетное секвенирование
          </Title>
          {headerActions}
        </Flex>
      </Header>
      {children}
    </Layout>
  );
};
