import { Outlet, useLocation } from 'react-router-dom';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';
import ClientNotificationBell from '../../components/Client/ClientNotificationBell';

const ClientLayout = () => {
  const location = useLocation();
  return (
    // resetKey forces the boundary to clear any stale error state on every
    // route change so a crash on one client page never blocks the next page.
    <ClientErrorBoundary resetKey={location.pathname}>
      <div className="min-h-[calc(var(--app-vh,1vh)*100)] bg-[var(--hud-bg)]">
        <header className="w-full flex items-center justify-end px-6 py-4">
          <ClientNotificationBell />
        </header>
        <Outlet />
      </div>
    </ClientErrorBoundary>
  );
};

export default ClientLayout;
