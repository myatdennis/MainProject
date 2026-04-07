import { Link, Outlet, useLocation } from 'react-router-dom';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';
import ClientNotificationBell from '../../components/Client/ClientNotificationBell';

const ClientLayout = () => {
  const location = useLocation();
  return (
    // resetKey forces the boundary to clear any stale error state on every
    // route change so a crash on one client page never blocks the next page.
    <ClientErrorBoundary resetKey={location.pathname}>
      <div className="min-h-[calc(var(--app-vh,1vh)*100)] bg-[var(--hud-bg)]">
        <header className="w-full flex items-center justify-end gap-3 px-6 py-4">
          <Link
            to="/client/surveys"
            className="inline-flex items-center rounded-full border border-slate/20 bg-white px-3 py-1.5 text-sm font-medium text-slate/80 transition hover:border-slate/40 hover:text-slate"
          >
            Surveys
          </Link>
          <ClientNotificationBell />
        </header>
        <Outlet />
      </div>
    </ClientErrorBoundary>
  );
};

export default ClientLayout;
