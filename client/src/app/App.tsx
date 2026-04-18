import { UploadPage } from '../pages/ui/UploadPage';
import { AppLayout } from './layout/layout';
import { DockerCheck } from '../widgets';

export const App = () => {
  return (
    <AppLayout>
      <DockerCheck>
        <UploadPage />
      </DockerCheck>
    </AppLayout>
  );
};
