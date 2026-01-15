import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MailPlus, ShieldCheck, Users } from 'lucide-react';
import LoadingButton from '../LoadingButton';
import { useToast } from '../../context/ToastContext';
import { createOnboardingOrg, InviteInput, OnboardingOrgResponse } from '../../dal/onboarding';

const wizardSteps = [
  { id: 'details', title: 'Organization details', description: 'Basics, contact, and plan info.' },
  { id: 'owners', title: 'Ownership & guardrails', description: 'Assign owner/admin with guardrails.' },
  { id: 'invites', title: 'Team invites & review', description: 'Queue invites and review launch checklist.' },
] as const;

const timezoneOptions = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
];

const subscriptionTiers = ['Standard', 'Premium', 'Enterprise'];
const roleOptions = [
  { label: 'Owner', value: 'owner' },
  { label: 'Admin', value: 'admin' },
  { label: 'Manager', value: 'manager' },
  { label: 'Member', value: 'member' },
];

interface WizardState {
  details: {
    name: string;
    type: string;
    industry: string;
    size: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    website: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    description: string;
    subscription: string;
    timezone: string;
    tagsInput: string;
  };
  owner: {
    ownerEmail: string;
    ownerUserId: string;
    ownerRole: string;
    backupEmail: string;
    backupUserId: string;
    backupRole: string;
  };
  team: {
    inviteDraftEmail: string;
    inviteDraftRole: string;
    inviteBulkText: string;
    invites: InviteInput[];
    notes: string;
  };
  features: {
    sandboxEnabled: boolean;
    analyticsEnabled: boolean;
    activationChecklist: boolean;
  };
}

const initialState: WizardState = {
  details: {
    name: '',
    type: '',
    industry: '',
    size: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    description: '',
    subscription: 'Standard',
    timezone: 'UTC',
    tagsInput: '',
  },
  owner: {
    ownerEmail: '',
    ownerUserId: '',
    ownerRole: 'owner',
    backupEmail: '',
    backupUserId: '',
    backupRole: 'admin',
  },
  team: {
    inviteDraftEmail: '',
    inviteDraftRole: 'member',
    inviteBulkText: '',
    invites: [],
    notes: '',
  },
  features: {
    sandboxEnabled: true,
    analyticsEnabled: true,
    activationChecklist: true,
  },
};

export interface OrgWizardProps {
  onComplete?: (response: OnboardingOrgResponse) => void;
  onCancel?: () => void;
}

const OrgWizard = ({ onComplete, onCancel }: OrgWizardProps) => {
  const { showToast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentStep = wizardSteps[stepIndex];

  const updateDetails = (key: keyof WizardState['details'], value: string) => {
    setState((prev) => ({ ...prev, details: { ...prev.details, [key]: value } }));
  };

  const updateOwner = (key: keyof WizardState['owner'], value: string) => {
    setState((prev) => ({ ...prev, owner: { ...prev.owner, [key]: value } }));
  };

  const updateTeam = (key: keyof WizardState['team'], value: string | InviteInput[]) => {
    setState((prev) => ({ ...prev, team: { ...prev.team, [key]: value } }));
  };

  const updateFeatureToggle = (key: keyof WizardState['features']) => {
    setState((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  const validateStep = (index: number): boolean => {
    const nextErrors: Record<string, string> = {};
    if (index === 0) {
      if (!state.details.name.trim()) nextErrors.name = 'Organization name is required';
      if (!state.details.contactPerson.trim()) nextErrors.contactPerson = 'Contact required';
      if (!state.details.contactEmail.trim()) nextErrors.contactEmail = 'Email required';
    } else if (index === 1) {
      if (!state.owner.ownerEmail.trim() && !state.owner.ownerUserId.trim()) {
        nextErrors.owner = 'Owner email or user ID required';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(stepIndex)) return;
    setStepIndex((idx) => Math.min(idx + 1, wizardSteps.length - 1));
  };

  const goBack = () => {
    setStepIndex((idx) => Math.max(idx - 1, 0));
  };

  const addInvite = () => {
    const email = state.team.inviteDraftEmail.trim().toLowerCase();
    if (!email) {
      showToast('Enter an email before adding.', 'error');
      return;
    }
    if (state.team.invites.some((invite) => invite.email === email)) {
      showToast('Invite already added.', 'warning');
      return;
    }
    const nextInvites = [...state.team.invites, { email, role: state.team.inviteDraftRole }];
    updateTeam('invites', nextInvites);
    updateTeam('inviteDraftEmail', '');
  };

  const removeInvite = (email: string) => {
    updateTeam(
      'invites',
      state.team.invites.filter((invite) => invite.email !== email),
    );
  };

  const ingestBulkInvites = () => {
    const entries = state.team.inviteBulkText
      .split(/\n|,/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (!entries.length) {
      showToast('Provide at least one email.', 'error');
      return;
    }
    const additions: InviteInput[] = [];
    entries.forEach((entry) => {
      const [email, roleCandidate] = entry.split(/\s|;/).filter(Boolean);
      const normalizedEmail = email?.toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) return;
      if (state.team.invites.some((invite) => invite.email === normalizedEmail)) return;
      additions.push({ email: normalizedEmail, role: roleCandidate || 'member' });
    });
    if (!additions.length) {
      showToast('No new invites were parsed.', 'warning');
      return;
    }
    updateTeam('invites', [...state.team.invites, ...additions]);
    updateTeam('inviteBulkText', '');
    showToast(`${additions.length} invite${additions.length === 1 ? '' : 's'} added`, 'success');
  };

  const buildPayload = () => {
    const tags = state.details.tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const owner = state.owner.ownerUserId
      ? { userId: state.owner.ownerUserId.trim(), role: state.owner.ownerRole }
      : { email: state.owner.ownerEmail.trim(), role: state.owner.ownerRole };

    const backupAdmin = state.owner.backupEmail.trim() || state.owner.backupUserId.trim()
      ? state.owner.backupUserId
        ? { userId: state.owner.backupUserId.trim(), role: state.owner.backupRole }
        : { email: state.owner.backupEmail.trim(), role: state.owner.backupRole }
      : undefined;

    return {
      name: state.details.name.trim(),
      type: state.details.type || undefined,
      contactPerson: state.details.contactPerson.trim(),
      contactEmail: state.details.contactEmail.trim(),
      subscription: state.details.subscription,
      timezone: state.details.timezone,
      owner,
      backupAdmin,
      invites: state.team.invites,
      tags: tags.length ? tags : undefined,
      features: {
        sandboxEnabled: state.features.sandboxEnabled,
        analytics: state.features.analyticsEnabled,
        activationChecklist: state.features.activationChecklist,
      },
      settings: {
        phone: state.details.contactPhone || undefined,
        website: state.details.website || undefined,
        address: state.details.address || undefined,
        city: state.details.city || undefined,
        state: state.details.state || undefined,
        postalCode: state.details.postalCode || undefined,
        notes: state.details.description || undefined,
        size: state.details.size || undefined,
        industry: state.details.industry || undefined,
      },
    };
  };

  const handleSubmit = async () => {
    if (!validateStep(stepIndex)) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const response = await createOnboardingOrg(payload);
      showToast('Organization created and onboarding initialized.', 'success');
      onComplete?.(response);
      setState(initialState);
      setStepIndex(0);
    } catch (error: any) {
      console.error('[OrgWizard] Failed to create organization', error);
      showToast(error?.message || 'Failed to create organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const completion = useMemo(() => ((stepIndex + 1) / wizardSteps.length) * 100, [stepIndex]);

  const renderStep = () => {
    if (currentStep.id === 'details') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization Name *</label>
              <input
                type="text"
                value={state.details.name}
                onChange={(e) => updateDetails('name', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Timezone</label>
              <select
                value={state.details.timezone}
                onChange={(e) => updateDetails('timezone', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Person *</label>
              <input
                type="text"
                value={state.details.contactPerson}
                onChange={(e) => updateDetails('contactPerson', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {errors.contactPerson && <p className="text-xs text-red-600 mt-1">{errors.contactPerson}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Email *</label>
              <input
                type="email"
                value={state.details.contactEmail}
                onChange={(e) => updateDetails('contactEmail', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {errors.contactEmail && <p className="text-xs text-red-600 mt-1">{errors.contactEmail}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subscription</label>
              <select
                value={state.details.subscription}
                onChange={(e) => updateDetails('subscription', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {subscriptionTiers.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
              <input
                type="text"
                value={state.details.tagsInput}
                onChange={(e) => updateDetails('tagsInput', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
              <input
                type="tel"
                value={state.details.contactPhone}
                onChange={(e) => updateDetails('contactPhone', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input
                type="url"
                value={state.details.website}
                onChange={(e) => updateDetails('website', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              type="text"
              value={state.details.address}
              onChange={(e) => updateDetails('address', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <input
                type="text"
                value={state.details.city}
                placeholder="City"
                onChange={(e) => updateDetails('city', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="text"
                value={state.details.state}
                placeholder="State"
                onChange={(e) => updateDetails('state', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="text"
                value={state.details.postalCode}
                placeholder="Postal Code"
                onChange={(e) => updateDetails('postalCode', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes / Goals</label>
            <textarea
              value={state.details.description}
              onChange={(e) => updateDetails('description', e.target.value)}
              rows={4}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            ></textarea>
          </div>
        </div>
      );
    }

    if (currentStep.id === 'owners') {
      return (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg text-sm text-orange-900 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-orange-500" />
            <p>
              Every organization needs an owner plus a backup admin. Provide an existing user ID or an email to send an invite with guardrails applied automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-800">Owner (required)</label>
              <input
                type="email"
                value={state.owner.ownerEmail}
                placeholder="owner@example.com"
                onChange={(e) => updateOwner('ownerEmail', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="text"
                value={state.owner.ownerUserId}
                placeholder="Or existing user ID"
                onChange={(e) => updateOwner('ownerUserId', e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800">Backup Admin</label>
              <input
                type="email"
                value={state.owner.backupEmail}
                placeholder="backup@example.com"
                onChange={(e) => updateOwner('backupEmail', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="text"
                value={state.owner.backupUserId}
                placeholder="Or existing user ID"
                onChange={(e) => updateOwner('backupUserId', e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Owner Role</label>
              <select
                value={state.owner.ownerRole}
                onChange={(e) => updateOwner('ownerRole', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {roleOptions.slice(0, 2).map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Backup Role</label>
              <select
                value={state.owner.backupRole}
                onChange={(e) => updateOwner('backupRole', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={state.features.sandboxEnabled}
                onChange={() => updateFeatureToggle('sandboxEnabled')}
              />
              <div>
                <p className="font-medium text-gray-900">Sandbox environment</p>
                <p className="text-xs text-gray-500">Pre-load demo data for the new tenant.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={state.features.analyticsEnabled}
                onChange={() => updateFeatureToggle('analyticsEnabled')}
              />
              <div>
                <p className="font-medium text-gray-900">Analytics enabled</p>
                <p className="text-xs text-gray-500">Allow owners to view analytics out of the gate.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={state.features.activationChecklist}
                onChange={() => updateFeatureToggle('activationChecklist')}
              />
              <div>
                <p className="font-medium text-gray-900">Activation checklist</p>
                <p className="text-xs text-gray-500">Track milestones on the onboarding dashboard.</p>
              </div>
            </label>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Invite Email</label>
            <input
              type="email"
              value={state.team.inviteDraftEmail}
              placeholder="teammate@example.com"
              onChange={(e) => updateTeam('inviteDraftEmail', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select
              value={state.team.inviteDraftRole}
              onChange={(e) => updateTeam('inviteDraftRole', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <LoadingButton onClick={addInvite} variant="secondary">
          <MailPlus className="h-4 w-4" />
          Queue invite
        </LoadingButton>

        <div>
          <label className="text-sm font-medium text-gray-700">Bulk invites</label>
          <textarea
            value={state.team.inviteBulkText}
            onChange={(e) => updateTeam('inviteBulkText', e.target.value)}
            placeholder="one@example.com\ntwo@example.com manager"
            rows={4}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          ></textarea>
          <LoadingButton onClick={ingestBulkInvites} variant="secondary" className="mt-3">
            <Users className="h-4 w-4" />
            Parse bulk list
          </LoadingButton>
        </div>

        {state.team.invites.length > 0 && (
          <div className="border border-gray-100 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Queued invites</h4>
            <div className="space-y-2">
              {state.team.invites.map((invite) => (
                <div key={invite.email} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-gray-900">{invite.email}</p>
                    <p className="text-xs text-gray-500">{invite.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInvite(invite.email)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700">Operational notes</label>
          <textarea
            value={state.team.notes}
            onChange={(e) => updateTeam('notes', e.target.value)}
            rows={3}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          ></textarea>
          <p className="text-xs text-gray-500 mt-1">Shared with the onboarding squad for context.</p>
        </div>

        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg p-4">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-semibold text-green-900">Ready to launch</p>
            <p className="text-sm text-green-800">
              Submitting will create the org, set up the checklist, and queue {state.team.invites.length || 'any'} invites with guardrails in place.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
      <div className="border-b border-gray-100 p-6">
        <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide">Client onboarding</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-2">{currentStep.title}</h2>
        <p className="text-gray-600">{currentStep.description}</p>
        <div className="mt-4 h-2 bg-gray-100 rounded-full">
          <div className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500" style={{ width: `${completion}%` }}></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          {wizardSteps.map((step, idx) => (
            <span
              key={step.id}
              className={`px-3 py-1 rounded-full border ${idx === stepIndex ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200'}`}
            >
              Step {idx + 1}: {step.title}
            </span>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">{renderStep()}</div>

      <div className="border-t border-gray-100 p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-500">
          Need to pause?
          <button className="ml-2 underline" type="button" onClick={onCancel}>
            Return to org list
          </button>
        </div>
        <div className="flex items-center gap-3">
          <LoadingButton onClick={goBack} variant="secondary" disabled={stepIndex === 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </LoadingButton>
          {stepIndex < wizardSteps.length - 1 ? (
            <LoadingButton onClick={goNext} variant="primary">
              Continue
            </LoadingButton>
          ) : (
            <LoadingButton onClick={handleSubmit} loading={submitting} variant="primary">
              Launch organization
            </LoadingButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgWizard;
