import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import ProfileView from '../../components/ProfileView';
import LoadingButton from '../../components/LoadingButton';
import InviteManager from '../../components/onboarding/InviteManager';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';

const AdminOrgProfile: React.FC = () => {
  const { orgProfileId } = useParams<{ orgProfileId: string }>();

  const orgId = useMemo(() => {
    if (!orgProfileId) return null;
    if (orgProfileId.startsWith('org-profile-')) {
      return orgProfileId.replace('org-profile-', '');
    }
    return orgProfileId;
  }, [orgProfileId]);

  const {
    loading: progressLoading,
    error: progressError,
    summary,
    steps,
    completionPercent,
    frictionAlerts,
    invites,
    refresh,
  } = useOnboardingProgress(orgId ?? undefined, {
    pollIntervalMs: 60000,
  });

  const inviteStats = useMemo(() => {
    const list = Array.isArray(invites) ? invites : [];
    const pending = list.filter((invite: any) => invite.status === 'pending' || invite.status === 'sent').length;
    const accepted = list.filter((invite: any) => invite.status === 'accepted').length;
    const stale = list.filter((invite: any) => invite.status === 'expired' || invite.status === 'bounced').length;
    return { pending, accepted, stale };
  }, [invites]);

  if (!orgProfileId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Organization Profile ID Not Found</h3>
          <p className="text-gray-600 mb-4">Please select an organization to view their profile.</p>
          <Link 
            to="/admin/organizations" 
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to Organizations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="mb-6">
        <Link 
          to="/admin/organizations" 
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organizations
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {summary?.orgName || 'Organization Profile'}
            </h1>
            <p className="text-gray-600">
              Track onboarding progress, invites, and operational readiness.
            </p>
          </div>
          {orgId && (
            <LoadingButton onClick={refresh} loading={progressLoading} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Sync Progress
            </LoadingButton>
          )}
        </div>
      </div>

      {progressError && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Unable to load onboarding progress.</p>
            <p className="text-sm">{progressError}. Try refreshing.</p>
          </div>
          <LoadingButton onClick={refresh} loading={progressLoading} variant="secondary" className="ml-auto">
            Retry
          </LoadingButton>
        </div>
      )}

      {orgId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-lg card-hover">
            <p className="text-sm font-medium text-gray-600">Onboarding completion</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{completionPercent}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {summary ? `${summary.completedSteps} of ${summary.totalSteps} steps complete` : 'Waiting for telemetry'}
            </p>
            <div className="mt-4 h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500"
                style={{ width: `${completionPercent}%` }}
              ></div>
            </div>
          </div>
          <div className="card-lg card-hover">
            <p className="text-sm font-medium text-gray-600">Invite status</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pending / Sent</span>
                <span className="text-xl font-semibold text-gray-900">{inviteStats.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Accepted</span>
                <span className="text-xl font-semibold text-emerald-600">{inviteStats.accepted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Stale / Bounced</span>
                <span className="text-xl font-semibold text-rose-600">{inviteStats.stale}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Last invite sent: {summary?.lastSentAt ? new Date(summary.lastSentAt).toLocaleString() : '—'}
            </p>
          </div>
          <div className="card-lg card-hover">
            <p className="text-sm font-medium text-gray-600">Friction alerts</p>
            <div className="mt-4 space-y-3">
              {frictionAlerts.length === 0 ? (
                <div className="flex items-center gap-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  No blockers detected.
                </div>
              ) : (
                frictionAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 text-sm text-rose-700">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <p>{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {orgId && (
        <div className="card-lg card-hover">
          <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Activation checklist</h2>
              <p className="text-sm text-gray-600">Monitor milestones to ensure the org is launch-ready.</p>
            </div>
            <LoadingButton onClick={refresh} loading={progressLoading} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </LoadingButton>
          </div>
          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-gray-100 rounded-xl p-4"
              >
                <div>
                  <p className="text-base font-medium text-gray-900">{step.title}</p>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      step.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : step.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-800'
                        : step.status === 'blocked'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {step.status.replace(/_/g, ' ')}
                  </span>
                  {step.completedAt && (
                    <p className="text-xs text-gray-500">
                      Completed {new Date(step.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orgId && (
        <InviteManager orgId={orgId} onInvitesChanged={() => refresh()} />
      )}

      <ProfileView 
        profileType="organization" 
        profileId={orgProfileId} 
        isAdmin={true}
      />
    </div>
  );
};

export default AdminOrgProfile;