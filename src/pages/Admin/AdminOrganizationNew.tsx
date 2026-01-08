import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import OrgWizard from '../../components/onboarding/OrgWizard';

const AdminOrganizationNew: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleComplete = (response: { data: { id: string }; invites?: Array<Record<string, unknown>> }) => {
    const inviteCount = response.invites?.length ?? 0;
    const message = inviteCount
      ? `Organization ready. ${inviteCount} invite${inviteCount === 1 ? '' : 's'} queued.`
      : 'Organization created successfully.';
    showToast(message, 'success');
    navigate(`/admin/organizations/${response.data.id}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/organizations')}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
            title="Back to Organizations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <Breadcrumbs
              items={[
                { label: 'Admin', to: '/admin' },
                { label: 'Organizations', to: '/admin/organizations' },
                { label: 'Create', to: '/admin/organizations/new' },
              ]}
            />
            <h1 className="text-3xl font-bold text-gray-900">New Client Onboarding</h1>
            <p className="text-gray-600">Launch a new tenant with the guided workflow.</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3 text-sm text-orange-900">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <p>
            The wizard enforces owner guardrails, initializes activation milestones, and queues invites with telemetry. Complete all three steps to hand off a launch-ready workspace.
          </p>
        </div>
      </div>

      <OrgWizard onComplete={handleComplete} onCancel={() => navigate('/admin/organizations')} />
    </div>
  );
};

export default AdminOrganizationNew;