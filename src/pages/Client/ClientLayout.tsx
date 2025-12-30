import { Outlet } from 'react-router-dom';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';

const ClientLayout = () => (
  <ClientErrorBoundary>
    <div className="min-h-[calc(var(--app-vh,1vh)*100)] bg-[var(--hud-bg)]">
      <Outlet />
    </div>
  </ClientErrorBoundary>
);

export default ClientLayout;
