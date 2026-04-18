import { Layout, Typography, Flex } from 'antd';
import { type PropsWithChildren } from 'react';

import classes from './layout.module.css';

const { Header } = Layout;
const { Title } = Typography;

export const AppLayout = ({ children }: PropsWithChildren) => {
  return (
    <Layout className={classes.layout}>
      <Header className={classes.header}>
        <Flex align="center" className={classes.headerContent}>
          <Title level={4} className={classes.title}>
            Таргетное секвенирование
          </Title>
        </Flex>
      </Header>
      {children}
    </Layout>
  );
};
