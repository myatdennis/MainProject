export type OnboardingStepId =
  | 'org_created'
  | 'assign_owner'
  | 'invite_team'
  | 'brand_workspace'
  | 'launch_first_course'
  | 'review_analytics';

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  title: string;
  description: string;
  phase: 'setup' | 'team' | 'content' | 'adoption';
  autoComplete?: boolean;
}

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepDefinition> = [
  {
    id: 'org_created',
    title: 'Organization created',
    description: 'Organization record created and sandbox enabled.',
    phase: 'setup',
    autoComplete: true,
  },
  {
    id: 'assign_owner',
    title: 'Assign owner & backup admin',
    description: 'Ensure at least one owner and backup admin are assigned.',
    phase: 'setup',
  },
  {
    id: 'invite_team',
    title: 'Invite teammates',
    description: 'Send invites to core collaborators and managers.',
    phase: 'team',
  },
  {
    id: 'brand_workspace',
    title: 'Configure branding',
    description: 'Upload logos, colors, and communication preferences.',
    phase: 'content',
  },
  {
    id: 'launch_first_course',
    title: 'Publish first course',
    description: 'Publish initial content and share with learners.',
    phase: 'content',
  },
  {
    id: 'review_analytics',
    title: 'Review analytics',
    description: 'Review dashboards to confirm data is flowing.',
    phase: 'adoption',
  },
];

const orderMap = new Map<OnboardingStepId, number>(
  ONBOARDING_STEPS.map((step, index) => [step.id, index])
);

export const getStepOrder = (stepId: OnboardingStepId): number => {
  return orderMap.get(stepId) ?? Number.MAX_SAFE_INTEGER;
};

export const getStepDefinition = (stepId: OnboardingStepId): OnboardingStepDefinition | undefined => {
  return ONBOARDING_STEPS.find((step) => step.id === stepId);
};

export const getDefaultOnboardingProgress = () => ({
  totalSteps: ONBOARDING_STEPS.length,
  completedSteps: ONBOARDING_STEPS.filter((step) => step.autoComplete).length,
  steps: ONBOARDING_STEPS.map((step) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    phase: step.phase,
    status: step.autoComplete ? ('completed' as OnboardingStepStatus) : ('pending' as OnboardingStepStatus),
  })),
});
