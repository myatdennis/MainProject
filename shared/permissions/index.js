const PERMISSIONS = {
  'platform.manageTenants': {
    description: 'Create, update, or delete organizations and impersonate tenant admins',
    scope: 'platform',
  },
  'platform.manageFeatureFlags': {
    description: 'Toggle feature flags and platform-wide experiments',
    scope: 'platform',
  },
  'platform.viewAnalyticsGlobal': {
    description: 'View analytics for all organizations',
    scope: 'platform',
  },
  'platform.impersonateOrg': {
    description: 'Enter org context as support staff with full visibility',
    scope: 'platform',
  },
  'platform.manageOnboarding': {
    description: 'Configure onboarding flows, activation milestones, and invite programs',
    scope: 'platform',
  },
  'org.manageMembers': {
    description: 'Invite, deactivate, or update members inside an organization',
    scope: 'org',
  },
  'org.manageAdmins': {
    description: 'Promote or demote org admins and managers',
    scope: 'org',
  },
  'org.manageInvites': {
    description: 'Send, resend, and revoke organization invitations',
    scope: 'org',
  },
  'org.viewActivationStatus': {
    description: 'View onboarding checklist and activation progress',
    scope: 'org',
  },
  'org.manageBilling': {
    description: 'View invoices, update payment methods, and change plan tiers',
    scope: 'org',
  },
  'org.manageContent': {
    description: 'Create, edit, and archive courses for the organization',
    scope: 'org',
  },
  'org.manageIntegrations': {
    description: 'Configure SSO, webhooks, and downstream integrations',
    scope: 'org',
  },
  'org.viewAnalytics': {
    description: 'View org-wide analytics dashboards',
    scope: 'org',
  },
  'org.exportData': {
    description: 'Export analytics or learner data outside the platform',
    scope: 'org',
  },
  'org.viewSensitiveData': {
    description: 'View PII such as personal emails or custom demographics',
    scope: 'org',
  },
  'org.manageSettings': {
    description: 'Update branding, communication preferences, and cohorts',
    scope: 'org',
  },
  'team.manageMembers': {
    description: 'Manage learners within assigned cohorts or teams',
    scope: 'team',
  },
  'team.viewAnalytics': {
    description: 'See analytics for assigned cohorts only',
    scope: 'team',
  },
  'content.edit': {
    description: 'Edit course content you own',
    scope: 'content',
  },
  'content.publish': {
    description: 'Publish, retire, or version controlled content',
    scope: 'content',
  },
};

const ROLE_PERMISSIONS = {
  platform_admin: [
    'platform.manageTenants',
    'platform.manageFeatureFlags',
    'platform.viewAnalyticsGlobal',
    'platform.impersonateOrg',
  'platform.manageOnboarding',
    'org.manageBilling',
    'org.manageMembers',
    'org.manageAdmins',
  'org.manageInvites',
  'org.viewActivationStatus',
    'org.manageContent',
    'org.viewAnalytics',
    'org.exportData',
    'org.manageIntegrations',
    'org.viewSensitiveData',
    'org.manageSettings',
    'content.edit',
    'content.publish',
  ],
  platform_support: [
    'platform.viewAnalyticsGlobal',
    'platform.impersonateOrg',
    'org.viewAnalytics',
    'org.manageMembers',
    'org.manageInvites',
    'org.viewActivationStatus',
  ],
  org_owner: [
    'org.manageBilling',
    'org.manageMembers',
    'org.manageAdmins',
    'org.manageInvites',
    'org.viewActivationStatus',
    'org.manageContent',
    'org.viewAnalytics',
    'org.exportData',
    'org.manageIntegrations',
    'org.viewSensitiveData',
    'org.manageSettings',
    'content.edit',
    'content.publish',
  ],
  org_admin: [
    'org.manageMembers',
    'org.manageContent',
    'org.viewAnalytics',
    'org.manageIntegrations',
    'org.manageSettings',
    'org.manageInvites',
    'org.viewActivationStatus',
    'content.edit',
  ],
  org_billing: [
    'org.manageBilling',
    'org.viewAnalytics',
  ],
  manager: [
    'team.manageMembers',
    'team.viewAnalytics',
    'org.viewAnalytics',
    'org.viewActivationStatus',
  ],
  instructor: [
    'content.edit',
    'team.viewAnalytics',
  ],
  member: [],
  guest: [],
  service_account: [
    'org.viewAnalytics',
    'org.exportData',
  ],
};

const ORG_ROLE_HIERARCHY = {
  org_owner: 5,
  org_admin: 4,
  manager: 3,
  instructor: 2,
  member: 1,
  guest: 0,
};

function arrayToSet(perms) {
  return new Set(perms || []);
}

export function getPermissionsForRole(role) {
  if (!role) return new Set();
  return arrayToSet(ROLE_PERMISSIONS[role] || []);
}

export function mergePermissions(...permissionIterables) {
  const result = new Set();
  permissionIterables.forEach((iterable) => {
    if (!iterable) return;
    for (const entry of iterable) {
      result.add(entry);
    }
  });
  return result;
}

export function hasPermissionFromSet(permissionSet, permission) {
  return permissionSet?.has(permission) ?? false;
}

export function hasPermission(role, permission) {
  return getPermissionsForRole(role).has(permission);
}

export function compareOrgRoles(currentRole, requiredRole) {
  const currentRank = ORG_ROLE_HIERARCHY[currentRole] ?? -1;
  const requiredRank = ORG_ROLE_HIERARCHY[requiredRole] ?? Number.POSITIVE_INFINITY;
  return currentRank - requiredRank;
}

export { PERMISSIONS, ROLE_PERMISSIONS, ORG_ROLE_HIERARCHY };

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ORG_ROLE_HIERARCHY,
  getPermissionsForRole,
  mergePermissions,
  hasPermission,
  hasPermissionFromSet,
  compareOrgRoles,
};
