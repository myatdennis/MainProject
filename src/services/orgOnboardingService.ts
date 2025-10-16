import { v4 as uuid } from 'uuid';

export interface OrgOnboardingTheme {
  primary: string;
  secondary: string;
  typography: 'montserrat' | 'lato' | 'quicksand';
  logoUrl: string;
  faviconUrl: string;
  darkModeOverrides: boolean;
}

export interface OrgOnboardingSettings {
  lms: {
    visibility: 'private' | 'catalog';
    completionRules: {
      videoThreshold: number;
      quizPass: number;
      showCertificates: boolean;
    };
  };
  notifications: {
    inApp: boolean;
    emailDigestCadence: 'daily' | 'weekly' | 'monthly';
  };
  surveys: {
    anonymityThreshold: number;
    language: string;
    templatePack: string;
  };
  rbac: {
    roles: Array<{
      key: 'ORG_ADMIN' | 'MANAGER' | 'LEARNER' | 'VIEWER';
      label: string;
      permissions: string[];
    }>;
  };
}

export interface OrgOnboardingSeedContent {
  preload: boolean;
  assignDemoCourseToInvites: boolean;
  courses: {
    deiFoundations: boolean;
    inclusiveLeadership: boolean;
  };
  surveys: {
    workplaceClimatePulse: boolean;
  };
  notifications: {
    welcome: boolean;
    gettingStarted: boolean;
    surveyGuide: boolean;
  };
}

export interface WizardInvitee {
  id: string;
  name: string;
  email: string;
  role: 'ORG_ADMIN' | 'MANAGER' | 'LEARNER' | 'VIEWER';
  groups: string[];
}

export interface OrgOnboardingPayload {
  organization: {
    id: string;
    name: string;
    industry: string;
    size: string;
    primaryContactName: string;
    primaryContactEmail: string;
    timezone: string;
    locale: string;
    tier: 'Free' | 'Standard' | 'Enterprise';
    slug: string;
  };
  theme: OrgOnboardingTheme;
  settings: OrgOnboardingSettings;
  seedContent: OrgOnboardingSeedContent;
  invitees: WizardInvitee[];
  sendInvitesNow: boolean;
}

interface CreateOrganizationResponse {
  organizationId: string;
  launchUrl: string;
}

const createOrganization = async (payload: OrgOnboardingPayload): Promise<CreateOrganizationResponse> => {
  // Simulate atomic creation across multiple tables by structuring a payload that could be
  // sent to a backend API. For now we mock the server response and log the payload so it can be
  // inspected during demos.
  const jobId = uuid();
  console.groupCollapsed('[OrgOnboarding] createOrganization', jobId);
  console.log('Payload', payload);
  console.groupEnd();

  await new Promise(resolve => setTimeout(resolve, 1200));

  return {
    organizationId: payload.organization.id,
    launchUrl: `/admin/organizations/${payload.organization.slug}`,
  };
};

const orgOnboardingService = {
  createOrganization,
};

export default orgOnboardingService;
