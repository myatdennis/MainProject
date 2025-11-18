import SEO from '../../components/SEO/SEO';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';

const ClientSurveys = () => {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <SEO title="My Surveys" description="View and complete assigned surveys." />
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/client/dashboard' }, { label: 'Surveys', to: '/client/surveys' }]} />
      <Card tone="muted" className="mt-4 space-y-3">
        <h1 className="font-heading text-2xl font-bold text-charcoal">My Surveys</h1>
        <p className="text-sm text-slate/80">You don’t have any surveys yet. Check back later.</p>
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/client/dashboard">← Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ClientSurveys;
