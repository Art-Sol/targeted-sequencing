import { Flex, Button } from 'antd';
import { PageNames } from './consts';

interface HeaderNavProps {
  current: PageNames;
  onChange: (page: PageNames) => void;
  newAnalysisDisabled?: boolean;
  historyDisabled?: boolean;
}

export const HeaderNav = ({
  current,
  onChange,
  newAnalysisDisabled,
  historyDisabled,
}: HeaderNavProps) => (
  <Flex gap={8}>
    <Button
      type={current === PageNames.NEW ? 'primary' : 'default'}
      onClick={() => onChange(PageNames.NEW)}
      disabled={newAnalysisDisabled}
    >
      Новый анализ
    </Button>
    <Button
      type={current === PageNames.HISTORY ? 'primary' : 'default'}
      onClick={() => onChange(PageNames.HISTORY)}
      disabled={historyDisabled}
    >
      Выполненные анализы
    </Button>
  </Flex>
);
