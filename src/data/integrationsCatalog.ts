import {
  BarChart3,
  CreditCard,
  Database,
  Globe,
  Mail,
  MessageSquare,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface IntegrationCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  availability: 'supported' | 'beta' | 'planned';
  features: string[];
  setupSummary: string;
  setupSteps: string[];
  securityNotes: string[];
}

export const integrationsCatalog: IntegrationCatalogEntry[] = [
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing and learner communication automation.',
    category: 'Marketing',
    icon: Mail,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    availability: 'supported',
    features: ['Audience sync', 'Campaign segmentation', 'Lifecycle messaging'],
    setupSummary: 'Requires Mailchimp API key provisioning and a mapped audience for learner cohorts.',
    setupSteps: [
      'Create or confirm a Mailchimp audience for learner communications.',
      'Provision a restricted API key in your Mailchimp admin workspace.',
      'Coordinate the audience and field mapping with platform support.',
    ],
    securityNotes: [
      'Use a scoped API key with audience-only permissions.',
      'Do not paste secrets into screenshots or ticket comments.',
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and invoice-backed billing workflows.',
    category: 'Payments',
    icon: CreditCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    availability: 'supported',
    features: ['Checkout handoff', 'Subscription billing', 'Invoice reconciliation'],
    setupSummary: 'Stripe setups are provisioned centrally to keep billing and webhook security consistent.',
    setupSteps: [
      'Confirm the Stripe account owner and production account ID.',
      'Provide the billing contact and allowed webhook destinations.',
      'Complete a production webhook validation with support before enabling learners.',
    ],
    securityNotes: [
      'Use separate test and live Stripe workspaces.',
      'Webhook signing secrets must be rotated if shared outside approved admins.',
    ],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Live session delivery for facilitator-led learning events.',
    category: 'Communication',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    availability: 'supported',
    features: ['Meeting launch links', 'Host assignment', 'Session attendance export'],
    setupSummary: 'Zoom is supported for organizations running scheduled live learning events.',
    setupSteps: [
      'Provide the production Zoom account used for hosted sessions.',
      'Confirm meeting ownership and recording policy requirements.',
      'Review attendance export mapping with support.',
    ],
    securityNotes: [
      'Recordings should stay behind your approved retention policy.',
      'Host accounts need least-privilege scheduling permissions.',
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Operational notifications and facilitator workflow updates.',
    category: 'Communication',
    icon: MessageSquare,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    availability: 'beta',
    features: ['Completion alerts', 'Enrollment notifications', 'Escalation routing'],
    setupSummary: 'Slack support is limited beta and requires manual provisioning.',
    setupSteps: [
      'Identify the target Slack workspace and destination channels.',
      'Confirm which events need to trigger operational notifications.',
      'Request beta enablement before provisioning secrets.',
    ],
    securityNotes: [
      'Limit bot access to the channels required for delivery.',
      'Review mention and escalation policies before enabling alerts.',
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM-side enrollment and account reporting sync.',
    category: 'CRM',
    icon: Database,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    availability: 'planned',
    features: ['Account sync', 'Contact sync', 'Enrollment visibility'],
    setupSummary: 'Salesforce is on the roadmap but is not self-service today.',
    setupSteps: [
      'Capture the business process and field mapping requirements.',
      'Review the roadmap with platform support before committing customer workflows.',
    ],
    securityNotes: [
      'Do not promise production synchronization until the roadmap item is approved.',
    ],
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Public-site measurement and campaign attribution visibility.',
    category: 'Analytics',
    icon: BarChart3,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    availability: 'supported',
    features: ['Traffic measurement', 'Campaign attribution', 'Conversion tracking'],
    setupSummary: 'GA is supported for marketing-site analytics and high-level funnel analysis.',
    setupSteps: [
      'Provide the GA property ID and tagging requirements.',
      'Confirm whether you need GTM or direct script deployment.',
      'Validate conversion events after deployment.',
    ],
    securityNotes: [
      'Do not use GA to store learner-sensitive personal data.',
    ],
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Enterprise meeting coordination and collaboration support.',
    category: 'Communication',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    availability: 'planned',
    features: ['Meeting launch', 'Team notifications', 'Session coordination'],
    setupSummary: 'Teams is not production-enabled in this platform yet.',
    setupSteps: [
      'Document the Teams workflow you need so it can be prioritized correctly.',
    ],
    securityNotes: [
      'No production Teams credentials should be provisioned until support confirms readiness.',
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Marketing and CRM handoff for enterprise learner programs.',
    category: 'CRM',
    icon: Database,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    availability: 'beta',
    features: ['Contact sync', 'Lifecycle updates', 'Engagement exports'],
    setupSummary: 'HubSpot is limited beta and must be enabled per organization.',
    setupSteps: [
      'Confirm required contact properties and lifecycle stages.',
      'Review object mapping and ownership rules with support.',
      'Run a beta validation in a non-production portal first.',
    ],
    securityNotes: [
      'Use a private app token with the smallest required scopes.',
    ],
  },
];

export const integrationSupportItems = [
  {
    id: 'webhooks',
    title: 'Webhook Management',
    description:
      'Webhook endpoints are provisioned and rotated through the backend contract. Self-service editing is disabled until a fully audited webhook management API is in place.',
    actionLabel: 'Contact support',
    href: 'mailto:support@thehuddleco.com?subject=Webhook%20Provisioning',
    icon: Globe,
  },
  {
    id: 'api-access',
    title: 'API Access',
    description:
      'API credentials are issued through controlled support workflows. This avoids exposing secrets or half-configured integrations in the admin UI.',
    actionLabel: 'Request API access',
    href: 'mailto:support@thehuddleco.com?subject=API%20Access%20Request',
    icon: Shield,
  },
];
