import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import {
  ArrowLeft,
  Building2,
  Palette,
  Settings,
  Sparkles,
  Users,
  CheckCircle2,
  Upload,
  Plus,
  FileText,
  Mail,
  Loader2,
} from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';
import orgOnboardingService, {
  OrgOnboardingPayload,
  OrgOnboardingSeedContent,
  OrgOnboardingSettings,
  OrgOnboardingTheme,
  WizardInvitee,
} from '../../services/orgOnboardingService';
import { classNames } from '../../utils/classNames';

const typographyOptions = [
  {
    id: 'montserrat',
    label: 'Montserrat',
    headingFont: 'font-[\'Montserrat\']',
    bodyFont: 'font-[\'Montserrat\']',
  },
  {
    id: 'lato',
    label: 'Lato',
    headingFont: 'font-[\'Lato\']',
    bodyFont: 'font-[\'Lato\']',
  },
  {
    id: 'quicksand',
    label: 'Quicksand',
    headingFont: 'font-[\'Quicksand\']',
    bodyFont: 'font-[\'Quicksand\']',
  },
];

const subscriptionTiers = ['Free', 'Standard', 'Enterprise'] as const;

const industryOptions = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Manufacturing',
  'Retail',
  'Professional Services',
  'Other',
];

const sizeOptions = ['1-50', '51-250', '251-1,000', '1,001-5,000', '5,001+'];

const timezoneOptions = ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'];

const localeOptions = ['en-US', 'en-GB', 'es-ES', 'fr-FR'];

const steps = [
  { id: 'organization', title: 'Organization Details', description: 'Foundational information and access controls.' },
  { id: 'branding', title: 'Branding', description: 'Logos, colors, and typography to personalize the experience.' },
  { id: 'defaults', title: 'Default Settings', description: 'Learning, notification, and survey defaults applied at launch.' },
  { id: 'seed', title: 'Seed Content', description: 'Preload demo courses, surveys, and starter messages.' },
  { id: 'invites', title: 'Invite Users', description: 'Add administrators, managers, and learners to the org.' },
  { id: 'review', title: 'Review & Launch', description: 'Verify configuration and create the organization.' },
] as const;

type StepKey = (typeof steps)[number]['id'];

const defaultTheme: OrgOnboardingTheme = {
  primary: '#4f46e5',
  secondary: '#f97316',
  typography: 'montserrat',
  faviconUrl: '',
  logoUrl: '',
  darkModeOverrides: false,
};

const defaultSettings: OrgOnboardingSettings = {
  lms: {
    visibility: 'private',
    completionRules: {
      videoThreshold: 80,
      quizPass: 85,
      showCertificates: true,
    },
  },
  notifications: {
    inApp: true,
    emailDigestCadence: 'weekly',
  },
  surveys: {
    anonymityThreshold: 5,
    language: 'en-US',
    templatePack: 'dei'
  },
  rbac: {
    roles: [
      {
        key: 'ORG_ADMIN',
        label: 'Org Admin',
        permissions: ['manage_users', 'manage_courses', 'view_reports', 'configure_settings'],
      },
      {
        key: 'MANAGER',
        label: 'Manager',
        permissions: ['assign_courses', 'view_team_progress', 'schedule_surveys'],
      },
    ],
  },
};

const defaultSeedContent: OrgOnboardingSeedContent = {
  preload: true,
  assignDemoCourseToInvites: true,
  courses: {
    deiFoundations: true,
    inclusiveLeadership: true,
  },
  surveys: {
    workplaceClimatePulse: true,
  },
  notifications: {
    welcome: true,
    gettingStarted: true,
    surveyGuide: true,
  },
};

const createId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : uuid());

const defaultInvitees: WizardInvitee[] = [
  {
    id: createId(),
    name: '',
    email: '',
    role: 'ORG_ADMIN',
    groups: [],
  },
];

interface ValidationState {
  [key: string]: string | undefined;
}

const contrastRatio = (color1: string, color2: string) => {
  const toRgb = (hex: string) => {
    const normalized = hex.replace('#', '');
    const bigint = parseInt(normalized, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  };

  const luminance = (hex: string) => {
    const { r, g, b } = toRgb(hex);
    const srgb = [r, g, b].map(value => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  };

  const l1 = luminance(color1) + 0.05;
  const l2 = luminance(color2) + 0.05;

  return l1 > l2 ? l1 / l2 : l2 / l1;
};

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const AdminOnboardingWizard = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({});
  const [orgId] = useState(() => createId());
  const [organization, setOrganization] = useState<OrgOnboardingPayload['organization']>({
    name: '',
    industry: '',
    size: '',
    primaryContactName: '',
    primaryContactEmail: '',
    timezone: 'UTC',
    locale: 'en-US',
    tier: 'Standard',
    slug: '',
  });
  const [theme, setTheme] = useState<OrgOnboardingTheme>(defaultTheme);
  const [settings, setSettings] = useState<OrgOnboardingSettings>(defaultSettings);
  const [seedContent, setSeedContent] = useState<OrgOnboardingSeedContent>(defaultSeedContent);
  const [invitees, setInvitees] = useState<WizardInvitee[]>(defaultInvitees);
  const [sendInvitesNow, setSendInvitesNow] = useState(true);
  const formFieldIds = useMemo(
    () => ({
      organizationName: createId(),
      industry: createId(),
      size: createId(),
      primaryContactName: createId(),
      primaryContactEmail: createId(),
      timezone: createId(),
      locale: createId(),
      slug: createId(),
      primaryColor: createId(),
      secondaryColor: createId(),
      darkModeOverrides: createId(),
      lmsVisibility: createId(),
      videoThreshold: createId(),
      quizPass: createId(),
      showCertificates: createId(),
      inAppNotifications: createId(),
      digestCadence: createId(),
      surveyThreshold: createId(),
      surveyLanguage: createId(),
      surveyTemplatePack: createId(),
      preloadToggle: createId(),
      assignDemoCourse: createId(),
      deiCourse: createId(),
      inclusiveCourse: createId(),
      workplacePulse: createId(),
      welcomeNotification: createId(),
      startCourseNotification: createId(),
      surveyNotification: createId(),
      sendInvitesToggle: createId(),
    }),
    []
  );

  const currentStep = steps[currentStepIndex];

  const handleNext = () => {
    const errors: ValidationState = {};

    if (currentStep.id === 'organization') {
      if (!organization.name.trim()) {
        errors.name = 'Organization name is required.';
      }
      if (!organization.primaryContactName.trim()) {
        errors.primaryContactName = 'Primary contact name is required.';
      }
      if (!organization.primaryContactEmail.trim()) {
        errors.primaryContactEmail = 'Primary contact email is required.';
      } else if (!/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(organization.primaryContactEmail)) {
        errors.primaryContactEmail = 'Enter a valid email.';
      }
    }

    if (currentStep.id === 'branding') {
      if (contrastRatio(theme.primary, '#ffffff') < 4.5) {
        errors.primary = 'Primary color contrast is too low against white.';
      }
      if (contrastRatio(theme.secondary, '#111827') < 4.5) {
        errors.secondary = 'Secondary color contrast is too low against slate background.';
      }
    }

    if (currentStep.id === 'invites') {
      invitees.forEach((invitee, index) => {
        if (!invitee.email.trim()) {
          errors[`invite-${index}`] = 'Email is required for each invitee.';
        } else if (!/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(invitee.email)) {
          errors[`invite-${index}`] = 'Enter a valid email address.';
        }
      });
    }

    setValidation(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setCurrentStepIndex(index => Math.min(index + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStepIndex(index => Math.max(index - 1, 0));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: OrgOnboardingPayload = {
        organization: {
          id: orgId,
          ...organization,
          slug: organization.slug || generateSlug(organization.name),
        },
        theme,
        settings,
        seedContent,
        invitees,
        sendInvitesNow,
      };

      await orgOnboardingService.createOrganization(payload);
      showToast('Organization created successfully and ready to launch!', 'success');
      navigate(`/admin/organizations/${payload.organization.slug}`);
    } catch (error) {
      console.error(error);
      showToast('Failed to create organization. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const contrastWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (contrastRatio(theme.primary, '#ffffff') < 4.5) {
      warnings.push('Primary color contrast is below 4.5:1 against white.');
    }
    if (contrastRatio(theme.secondary, '#111827') < 4.5) {
      warnings.push('Secondary color contrast is below 4.5:1 against slate.');
    }
    return warnings;
  }, [theme.primary, theme.secondary]);

  const analyticsPreview = useMemo(
    () => [
      { label: 'Active Learners', value: 128 },
      { label: 'Courses Completed', value: 64 },
      { label: 'Avg. Quiz Score', value: '87%' },
      { label: 'Survey Response Rate', value: '72%' },
    ],
    []
  );

  const updateInvitee = (id: string, changes: Partial<WizardInvitee>) => {
    setInvitees(prev => prev.map(invitee => (invitee.id === id ? { ...invitee, ...changes } : invitee)));
  };

  const addInvitee = () => {
    setInvitees(prev => [
      ...prev,
      {
        id: createId(),
        name: '',
        email: '',
        role: 'LEARNER',
        groups: [],
      },
    ]);
  };

  const removeInvitee = (id: string) => {
    setInvitees(prev => (prev.length === 1 ? prev : prev.filter(invitee => invitee.id !== id)));
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result?.toString() ?? '';
      const rows = text.split(/\r?\n/).filter(Boolean);
      const parsedInvitees = rows
        .map(row => row.split(',').map(value => value.trim().replace(/^"|"$/g, '')))
        .filter(columns => columns.length >= 2)
        .map(columns => ({
          id: createId(),
          name: columns[0],
          email: columns[1],
          role: (columns[2] as WizardInvitee['role']) || 'LEARNER',
          groups: columns[3] ? columns[3].split(';').map(group => group.trim()).filter(Boolean) : [],
        }));

      if (parsedInvitees.length === 0) {
        showToast('No valid rows found in CSV file.', 'error');
        return;
      }

      setInvitees(parsedInvitees);
      showToast(`Loaded ${parsedInvitees.length} invitees from CSV.`, 'success');
    };
    reader.readAsText(file);
  };

  const onOrgNameChange = (value: string) => {
    setOrganization(prev => ({
      ...prev,
      name: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const renderStep = (id: StepKey) => {
    switch (id) {
      case 'organization':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor={formFieldIds.organizationName}
                >
                  Organization Name *
                </label>
                <input
                  type="text"
                  id={formFieldIds.organizationName}
                  value={organization.name}
                  onChange={event => onOrgNameChange(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  placeholder="Acme Corp"
                />
                {validation.name && <p className="mt-1 text-sm text-red-600">{validation.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.industry}>
                  Industry
                </label>
                <select
                  id={formFieldIds.industry}
                  value={organization.industry}
                  onChange={event => setOrganization(prev => ({ ...prev, industry: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select industry</option>
                  {industryOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.size}>
                  Organization Size
                </label>
                <select
                  id={formFieldIds.size}
                  value={organization.size}
                  onChange={event => setOrganization(prev => ({ ...prev, size: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select size</option>
                  {sizeOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subscription Tier</label>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {subscriptionTiers.map(tier => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setOrganization(prev => ({ ...prev, tier }))}
                      className={classNames(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-500',
                        organization.tier === tier
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor={formFieldIds.primaryContactName}
                >
                  Primary Contact Name *
                </label>
                <input
                  type="text"
                  id={formFieldIds.primaryContactName}
                  value={organization.primaryContactName}
                  onChange={event => setOrganization(prev => ({ ...prev, primaryContactName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  placeholder="Alex Johnson"
                />
                {validation.primaryContactName && (
                  <p className="mt-1 text-sm text-red-600">{validation.primaryContactName}</p>
                )}
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor={formFieldIds.primaryContactEmail}
                >
                  Primary Contact Email *
                </label>
                <input
                  type="email"
                  id={formFieldIds.primaryContactEmail}
                  value={organization.primaryContactEmail}
                  onChange={event => setOrganization(prev => ({ ...prev, primaryContactEmail: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  placeholder="alex.johnson@example.com"
                />
                {validation.primaryContactEmail && (
                  <p className="mt-1 text-sm text-red-600">{validation.primaryContactEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.timezone}>
                  Timezone
                </label>
                <select
                  id={formFieldIds.timezone}
                  value={organization.timezone}
                  onChange={event => setOrganization(prev => ({ ...prev, timezone: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                >
                  {timezoneOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.locale}>
                  Locale
                </label>
                <select
                  id={formFieldIds.locale}
                  value={organization.locale}
                  onChange={event => setOrganization(prev => ({ ...prev, locale: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                >
                  {localeOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.slug}>
                  Org Slug
                </label>
                <input
                  type="text"
                  id={formFieldIds.slug}
                  value={organization.slug}
                  onChange={event => setOrganization(prev => ({ ...prev, slug: generateSlug(event.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  placeholder="acme-corp"
                />
                <p className="mt-1 text-xs text-gray-500">Used for subdomain routing and APIs.</p>
              </div>
            </div>
          </div>
        );
      case 'branding':
        return (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Logo</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-500">
                    <Upload className="mr-2 h-4 w-4" /> Upload
                    <input
                      type="file"
                      accept="image/png,image/svg+xml"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        setTheme(prev => ({ ...prev, logoUrl: url }));
                      }}
                    />
                  </label>
                  {theme.logoUrl && (
                    <button
                      type="button"
                      className="text-sm text-orange-600 hover:text-orange-700"
                      onClick={() => setTheme(prev => ({ ...prev, logoUrl: '' }))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Favicon</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-500">
                    <Upload className="mr-2 h-4 w-4" /> Upload
                    <input
                      type="file"
                      accept="image/png,image/svg+xml"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        setTheme(prev => ({ ...prev, faviconUrl: url }));
                      }}
                    />
                  </label>
                  {theme.faviconUrl && (
                    <>
                      <img src={theme.faviconUrl} alt="Favicon preview" className="h-6 w-6 rounded" />
                      <button
                        type="button"
                        className="text-sm text-orange-600 hover:text-orange-700"
                        onClick={() => setTheme(prev => ({ ...prev, faviconUrl: '' }))}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.primaryColor}>
                    Primary Color
                  </label>
                  <input
                    type="color"
                    id={formFieldIds.primaryColor}
                    value={theme.primary}
                    onChange={event => setTheme(prev => ({ ...prev, primary: event.target.value }))}
                    className="mt-2 h-12 w-full cursor-pointer rounded-lg border border-gray-300"
                  />
                  {validation.primary && <p className="mt-1 text-sm text-red-600">{validation.primary}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.secondaryColor}>
                    Secondary Color
                  </label>
                  <input
                    type="color"
                    id={formFieldIds.secondaryColor}
                    value={theme.secondary}
                    onChange={event => setTheme(prev => ({ ...prev, secondary: event.target.value }))}
                    className="mt-2 h-12 w-full cursor-pointer rounded-lg border border-gray-300"
                  />
                  {validation.secondary && <p className="mt-1 text-sm text-red-600">{validation.secondary}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700" htmlFor={formFieldIds.typography}>
                    Typography
                  </label>
                  <div
                    id={formFieldIds.typography}
                    className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3"
                  >
                    {typographyOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(prev => ({ ...prev, typography: option.id }))}
                        className={classNames(
                          'rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500',
                          theme.typography === option.id
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label
                    className="inline-flex items-center text-sm text-gray-700"
                    htmlFor={formFieldIds.darkModeOverrides}
                  >
                    <input
                      type="checkbox"
                      checked={theme.darkModeOverrides}
                      onChange={event => setTheme(prev => ({ ...prev, darkModeOverrides: event.target.checked }))}
                      className="mr-2 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      id={formFieldIds.darkModeOverrides}
                    />
                    Provide dark mode overrides
                  </label>
                </div>
              </div>

              {contrastWarnings.length > 0 && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
                  <p className="font-medium">Contrast recommendations</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {contrastWarnings.map(warning => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live Preview</h3>
                  <p className="text-xs text-gray-500">Light and dark mode preview using selected theme</p>
                </div>
                {theme.logoUrl && <img src={theme.logoUrl} alt="Logo preview" className="h-10" />}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4" style={{ borderColor: theme.primary }}>
                <p className="text-xs font-semibold uppercase text-gray-500">Dashboard</p>
                <h4
                  className="mt-2 text-xl font-bold"
                  style={{ color: theme.primary, fontFamily: theme.typography === 'quicksand' ? 'Quicksand' : theme.typography === 'lato' ? 'Lato' : 'Montserrat' }}
                >
                  Welcome to {organization.name || 'Your Organization'}
                </h4>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {analyticsPreview.map(item => (
                    <div key={item.label} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-500">{item.label}</p>
                      <p
                        className="mt-1 text-lg font-semibold"
                        style={{ color: theme.secondary }}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-4 text-white">
                <p className="text-xs font-semibold uppercase text-gray-400">Dark Mode Preview</p>
                <h4
                  className="mt-2 text-xl font-bold"
                  style={{ color: theme.primary, fontFamily: theme.typography === 'quicksand' ? 'Quicksand' : theme.typography === 'lato' ? 'Lato' : 'Montserrat' }}
                >
                  Learning Experience
                </h4>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {analyticsPreview.map(item => (
                    <div key={item.label} className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                      <p className="text-xs font-semibold text-gray-400">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold" style={{ color: theme.secondary }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'defaults':
        return (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <Settings className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Learning Management</h3>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="text-gray-700" htmlFor={formFieldIds.lmsVisibility}>
                    Default Course Visibility
                  </label>
                  <select
                    id={formFieldIds.lmsVisibility}
                    value={settings.lms.visibility}
                    onChange={event =>
                      setSettings(prev => ({
                        ...prev,
                        lms: { ...prev.lms, visibility: event.target.value as OrgOnboardingSettings['lms']['visibility'] },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="private">Private (invite only)</option>
                    <option value="catalog">Catalog (visible to all learners)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-gray-700" htmlFor={formFieldIds.videoThreshold}>
                      Video Threshold %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      id={formFieldIds.videoThreshold}
                      value={settings.lms.completionRules.videoThreshold}
                      onChange={event =>
                        setSettings(prev => ({
                          ...prev,
                          lms: {
                            ...prev.lms,
                            completionRules: {
                              ...prev.lms.completionRules,
                              videoThreshold: Number(event.target.value),
                            },
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-gray-700" htmlFor={formFieldIds.quizPass}>
                      Quiz Pass %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      id={formFieldIds.quizPass}
                      value={settings.lms.completionRules.quizPass}
                      onChange={event =>
                        setSettings(prev => ({
                          ...prev,
                          lms: {
                            ...prev.lms,
                            completionRules: {
                              ...prev.lms.completionRules,
                              quizPass: Number(event.target.value),
                            },
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <label
                    className="flex items-center gap-2 pt-6 text-gray-700"
                    htmlFor={formFieldIds.showCertificates}
                  >
                    <input
                      type="checkbox"
                      id={formFieldIds.showCertificates}
                      checked={settings.lms.completionRules.showCertificates}
                      onChange={event =>
                        setSettings(prev => ({
                          ...prev,
                          lms: {
                            ...prev.lms,
                            completionRules: {
                              ...prev.lms.completionRules,
                              showCertificates: event.target.checked,
                            },
                          },
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>Show certificates</span>
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <Mail className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Notifications</h3>
              </div>
              <div className="space-y-4 text-sm">
                <label className="inline-flex items-center text-gray-700" htmlFor={formFieldIds.inAppNotifications}>
                  <input
                    type="checkbox"
                    id={formFieldIds.inAppNotifications}
                    checked={settings.notifications.inApp}
                    onChange={event =>
                      setSettings(prev => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          inApp: event.target.checked,
                        },
                      }))
                    }
                    className="mr-2 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  Enable in-app notifications
                </label>
                <div>
                  <label className="text-gray-700" htmlFor={formFieldIds.digestCadence}>
                    Email Digest Cadence
                  </label>
                  <select
                    id={formFieldIds.digestCadence}
                    value={settings.notifications.emailDigestCadence}
                    onChange={event =>
                      setSettings(prev => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          emailDigestCadence: event.target.value as OrgOnboardingSettings['notifications']['emailDigestCadence'],
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Survey Defaults</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <label className="text-gray-700" htmlFor={formFieldIds.surveyThreshold}>
                    Anonymity Threshold
                  </label>
                  <input
                    type="number"
                    min={1}
                    id={formFieldIds.surveyThreshold}
                    value={settings.surveys.anonymityThreshold}
                    onChange={event =>
                      setSettings(prev => ({
                        ...prev,
                        surveys: {
                          ...prev.surveys,
                          anonymityThreshold: Number(event.target.value),
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-gray-700" htmlFor={formFieldIds.surveyLanguage}>
                    Default Language
                  </label>
                  <select
                    id={formFieldIds.surveyLanguage}
                    value={settings.surveys.language}
                    onChange={event =>
                      setSettings(prev => ({
                        ...prev,
                        surveys: {
                          ...prev.surveys,
                          language: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  >
                    {localeOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-gray-700" htmlFor={formFieldIds.surveyTemplatePack}>
                    Template Pack
                  </label>
                  <select
                    id={formFieldIds.surveyTemplatePack}
                    value={settings.surveys.templatePack}
                    onChange={event =>
                      setSettings(prev => ({
                        ...prev,
                        surveys: {
                          ...prev.surveys,
                          templatePack: event.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="dei">DEI Essentials</option>
                    <option value="engagement">Engagement Pulse</option>
                    <option value="wellness">Wellness & Burnout</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <Users className="h-5 w-5" />
                <h3 className="text-lg font-semibold">RBAC Defaults</h3>
              </div>
              <div className="space-y-4 text-sm">
                {settings.rbac.roles.map(role => (
                  <div key={role.key} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{role.label}</p>
                        <p className="text-xs uppercase tracking-wide text-gray-500">{role.key}</p>
                      </div>
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                        {role.permissions.length} permissions
                      </span>
                    </div>
                    <ul className="mt-3 list-disc space-y-1 pl-4 text-gray-600">
                      {role.permissions.map(permission => (
                        <li key={permission}>{permission.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      case 'seed':
        return (
          <div className="space-y-6">
            <label
              className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm"
              htmlFor={formFieldIds.preloadToggle}
            >
              <input
                type="checkbox"
                id={formFieldIds.preloadToggle}
                checked={seedContent.preload}
                onChange={event => setSeedContent(prev => ({ ...prev, preload: event.target.checked }))}
                className="mr-3 h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              Preload demo content to accelerate go-live (recommended)
            </label>

            {seedContent.preload && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-gray-900">
                    <Sparkles className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">Courses</h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-700">
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.deiCourse}>
                      <input
                        type="checkbox"
                        id={formFieldIds.deiCourse}
                        checked={seedContent.courses.deiFoundations}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            courses: { ...prev.courses, deiFoundations: event.target.checked },
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">DEI Foundations</span>
                        <span className="block text-xs text-gray-500">Video lessons, knowledge check quiz, downloadable resource</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.inclusiveCourse}>
                      <input
                        type="checkbox"
                        id={formFieldIds.inclusiveCourse}
                        checked={seedContent.courses.inclusiveLeadership}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            courses: { ...prev.courses, inclusiveLeadership: event.target.checked },
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">Inclusive Leadership Microlearning</span>
                        <span className="block text-xs text-gray-500">5-minute primer with action checklist</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.assignDemoCourse}>
                      <input
                        type="checkbox"
                        id={formFieldIds.assignDemoCourse}
                        checked={seedContent.assignDemoCourseToInvites}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            assignDemoCourseToInvites: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">Assign demo course to invited users</span>
                        <span className="block text-xs text-gray-500">New learners receive demo assignments automatically</span>
                      </span>
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-gray-900">
                    <FileText className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">Surveys</h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-700">
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.workplacePulse}>
                      <input
                        type="checkbox"
                        id={formFieldIds.workplacePulse}
                        checked={seedContent.surveys.workplaceClimatePulse}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            surveys: {
                              ...prev.surveys,
                              workplaceClimatePulse: event.target.checked,
                            },
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">Workplace Climate Pulse</span>
                        <span className="block text-xs text-gray-500">Likert scale items with anonymity threshold baked in</span>
                      </span>
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-gray-900">
                    <Mail className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">Notifications</h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-700">
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.welcomeNotification}>
                      <input
                        type="checkbox"
                        id={formFieldIds.welcomeNotification}
                        checked={seedContent.notifications.welcome}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, welcome: event.target.checked },
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">Welcome to the LMS</span>
                        <span className="block text-xs text-gray-500">Greets new members with branded onboarding</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.startCourseNotification}>
                      <input
                        type="checkbox"
                        id={formFieldIds.startCourseNotification}
                        checked={seedContent.notifications.gettingStarted}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, gettingStarted: event.target.checked },
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">How to start your first course</span>
                        <span className="block text-xs text-gray-500">Guides learners to their first assignment</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3" htmlFor={formFieldIds.surveyNotification}>
                      <input
                        type="checkbox"
                        id={formFieldIds.surveyNotification}
                        checked={seedContent.notifications.surveyGuide}
                        onChange={event =>
                          setSeedContent(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, surveyGuide: event.target.checked },
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="font-medium">How to take a survey</span>
                        <span className="block text-xs text-gray-500">Explains survey participation expectations</span>
                      </span>
                    </label>
                  </div>
                </section>
              </div>
            )}
          </div>
        );
      case 'invites':
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Invite team members</h3>
                  <p className="text-sm text-gray-500">Upload CSV or add invitees manually. Roles determine access at launch.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-500">
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                </label>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Email</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Role</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Groups</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invitees.map((invitee, index) => (
                      <tr key={invitee.id}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={invitee.name}
                            onChange={event => updateInvitee(invitee.id, { name: event.target.value })}
                            placeholder="Jordan Lee"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="email"
                            value={invitee.email}
                            onChange={event => updateInvitee(invitee.id, { email: event.target.value })}
                            placeholder="jordan@example.com"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                          />
                          {validation[`invite-${index}`] && (
                            <p className="mt-1 text-xs text-red-600">{validation[`invite-${index}`]}</p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={invitee.role}
                            onChange={event => updateInvitee(invitee.id, { role: event.target.value as WizardInvitee['role'] })}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="ORG_ADMIN">Org Admin</option>
                            <option value="MANAGER">Manager</option>
                            <option value="LEARNER">Learner</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={invitee.groups.join(', ')}
                            onChange={event =>
                              updateInvitee(invitee.id, {
                                groups: event.target.value
                                  .split(',')
                                  .map(group => group.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="People Ops; Leadership"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                          />
                          <p className="mt-1 text-xs text-gray-400">Separate with commas or semicolons.</p>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeInvitee(invitee.id)}
                            className="text-sm text-red-500 hover:text-red-600 disabled:opacity-40"
                            disabled={invitees.length === 1}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addInvitee}
                className="mt-4 inline-flex items-center rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-500"
              >
                <Plus className="mr-2 h-4 w-4" /> Add another invitee
              </button>
            </div>

            <label
              className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm"
              htmlFor={formFieldIds.sendInvitesToggle}
            >
              <input
                type="checkbox"
                id={formFieldIds.sendInvitesToggle}
                checked={sendInvitesNow}
                onChange={event => setSendInvitesNow(event.target.checked)}
                className="mr-3 h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              Send invite emails immediately (with magic links)
            </label>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-gray-900">
                  <Building2 className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Organization Summary</h3>
                </div>
                <dl className="grid grid-cols-1 gap-4 text-sm text-gray-700 sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">Name</dt>
                    <dd className="font-medium">{organization.name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Industry</dt>
                    <dd className="font-medium">{organization.industry || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Tier</dt>
                    <dd className="font-medium">{organization.tier}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Timezone / Locale</dt>
                    <dd className="font-medium">
                      {organization.timezone} · {organization.locale}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Primary Contact</dt>
                    <dd className="font-medium">
                      {organization.primaryContactName} ({organization.primaryContactEmail})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Slug</dt>
                    <dd className="font-medium">{organization.slug || generateSlug(organization.name)}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-gray-900">
                  <Palette className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Branding</h3>
                </div>
                <div className="flex items-center gap-4">
                  {theme.logoUrl ? (
                    <img src={theme.logoUrl} alt="Logo" className="h-12" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                      <Palette className="h-6 w-6" />
                    </div>
                  )}
                  <div className="text-sm text-gray-700">
                    <p>
                      Primary: <span className="font-medium">{theme.primary}</span>
                    </p>
                    <p>
                      Secondary: <span className="font-medium">{theme.secondary}</span>
                    </p>
                    <p>
                      Typography: <span className="font-medium">{theme.typography}</span>
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-gray-900">
                  <Settings className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Defaults & Access</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>Course visibility: {settings.lms.visibility}</li>
                  <li>
                    Completion rules: {settings.lms.completionRules.videoThreshold}% video · {settings.lms.completionRules.quizPass}% quiz ·
                    certificates {settings.lms.completionRules.showCertificates ? 'enabled' : 'disabled'}
                  </li>
                  <li>Email digest cadence: {settings.notifications.emailDigestCadence}</li>
                  <li>
                    Surveys: anonymity ≥ {settings.surveys.anonymityThreshold} · language {settings.surveys.language} · template pack {settings.surveys.templatePack}
                  </li>
                  <li>
                    RBAC roles provisioned: {settings.rbac.roles.map(role => role.label).join(', ')}
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-gray-900">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Seed Content & Invites</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>Seeding enabled: {seedContent.preload ? 'Yes' : 'No'}</li>
                  {seedContent.preload && (
                    <>
                      <li>
                        Courses: {[
                          seedContent.courses.deiFoundations && 'DEI Foundations',
                          seedContent.courses.inclusiveLeadership && 'Inclusive Leadership Microlearning',
                        ]
                          .filter(Boolean)
                          .join(', ') || 'None'}
                      </li>
                      <li>Assign demo course to invitees: {seedContent.assignDemoCourseToInvites ? 'Yes' : 'No'}</li>
                      <li>Survey templates: {seedContent.surveys.workplaceClimatePulse ? 'Workplace Climate Pulse' : 'None'}</li>
                      <li>
                        Notifications: {[
                          seedContent.notifications.welcome && 'Welcome',
                          seedContent.notifications.gettingStarted && 'Start your first course',
                          seedContent.notifications.surveyGuide && 'Survey tips',
                        ]
                          .filter(Boolean)
                          .join(', ') || 'None'}
                      </li>
                    </>
                  )}
                  <li>Invite count: {invitees.length}</li>
                  <li>Send invites on launch: {sendInvitesNow ? 'Yes' : 'No'}</li>
                </ul>
              </section>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="font-semibold">RLS policies & telemetry will be provisioned automatically.</p>
                  <p className="text-sm">
                    Upon launch, tenant isolation, audit logging, and onboarding telemetry events (org_created, seed_content_created, invites_sent) will be recorded.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenant Onboarding Wizard</h1>
            <p className="text-sm text-gray-500">Create organizations with branded experiences, seeded content, and ready-to-go access in minutes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
          <nav className="space-y-3">
            {steps.map((step, index) => {
              const isCurrent = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={classNames(
                    'rounded-xl border p-4',
                    isCurrent
                      ? 'border-orange-500 bg-orange-50'
                      : isCompleted
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={classNames(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3 text-gray-900">
                {currentStep.id === 'organization' && <Building2 className="h-5 w-5" />}
                {currentStep.id === 'branding' && <Palette className="h-5 w-5" />}
                {currentStep.id === 'defaults' && <Settings className="h-5 w-5" />}
                {currentStep.id === 'seed' && <Sparkles className="h-5 w-5" />}
                {currentStep.id === 'invites' && <Users className="h-5 w-5" />}
                {currentStep.id === 'review' && <CheckCircle2 className="h-5 w-5" />}
                <div>
                  <h2 className="text-2xl font-semibold">{currentStep.title}</h2>
                  <p className="text-sm text-gray-500">{currentStep.description}</p>
                </div>
              </div>

              {renderStep(currentStep.id)}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 disabled:opacity-50"
              >
                Back
              </button>

              {currentStep.id !== 'review' ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                >
                  Continue
                </button>
              ) : (
                <LoadingButton
                  onClick={handleSubmit}
                  variant="primary"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create Organization
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOnboardingWizard;
