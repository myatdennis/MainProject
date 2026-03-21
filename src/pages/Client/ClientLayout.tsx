import { Outlet, useLocation } from 'react-router-dom';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';

const ClientLayout = () => {
  const location = useLocation();
  return (
    // resetKey forces the boundary to clear any stale error state on every
    // route change so a crash on one client page never blocks the next page.
    <ClientErrorBoundary resetKey={location.pathname}>
      <div className="min-h-[calc(var(--app-vh,1vh)*100)] bg-[var(--hud-bg)]">
        <Outlet />
      </div>
    </ClientErrorBoundary>
  );
};

export default ClientLayout;
