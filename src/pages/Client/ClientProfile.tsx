import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';

const ClientProfile = () => {
  const { user } = useAuth();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <SEO title="My Profile" description="Manage your profile and preferences." />
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/client/dashboard' }, { label: 'Profile', to: '/client/profile' }]} />
      <Card tone="muted" className="mt-4 space-y-3">
        <h1 className="font-heading text-2xl font-bold text-charcoal">My Profile</h1>
        <div className="text-sm text-slate/80">
          <div><span className="font-semibold">Name:</span> {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—' : '—'}</div>
          <div><span className="font-semibold">Email:</span> {user?.email || '—'}</div>
          <div><span className="font-semibold">Role:</span> {user?.role || '—'}</div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button asChild variant="ghost" size="sm">
            <a href="/client/dashboard">← Back to dashboard</a>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ClientProfile;
