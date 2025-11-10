import { Link, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <Card tone="muted" className="max-w-lg space-y-6 text-center" padding="lg">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">404</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-charcoal">Page not found</h1>
          <p className="mt-3 text-sm text-slate/80">
            We looked everywhere but couldn&apos;t find <code className="rounded bg-cloud px-1 py-0.5 text-xs text-slate/70">{location.pathname}</code>.
            Check the URL or head back to your dashboard.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="sm">
            <Link to="/">Go to homepage</Link>
          </Button>
          <Button variant="ghost" asChild size="sm">
            <Link to="/client/courses">Browse my courses</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;
