export const mapUserProfileResponse = (profileRow, userRow, organizationRow) => ({
  ...(() => {
    const orgId = profileRow?.organization_id || organizationRow?.id || userRow?.organization_id || null;
    return {
      id: profileRow?.id ?? null,
      userId: profileRow?.user_id ?? userRow?.id ?? null,
      name: profileRow?.name ?? [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ').trim(),
      email: profileRow?.email ?? userRow?.email ?? null,
      role: profileRow?.role ?? userRow?.role ?? null,
      organizationId: orgId,
      organization: organizationRow?.name ?? profileRow?.organization ?? null,
      title: profileRow?.title ?? null,
      department: profileRow?.department ?? null,
      location: profileRow?.location ?? null,
      timezone: profileRow?.timezone ?? null,
      phone: profileRow?.phone ?? null,
      language: profileRow?.language ?? null,
      pronouns: profileRow?.pronouns ?? null,
      preferences: profileRow?.preferences ?? {},
      accessibilityPrefs: profileRow?.accessibility_prefs ?? {},
      notificationSettings: profileRow?.notification_settings ?? {},
      createdAt: profileRow?.created_at ?? null,
      updatedAt: profileRow?.updated_at ?? null,
    };
  })(),
});

const toJsonValue = (value, fallback = {}) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  return fallback;
};

export const normalizeUserProfileUpdatePayload = (userId, input = {}, opts = {}) => {
  const payload = { user_id: userId };
  let hasChanges = false;
  const assign = (key, value) => {
    payload[key] = value;
    hasChanges = true;
  };

  if ('name' in input) assign('name', input.name ?? null);
  if ('email' in input) assign('email', input.email ?? null);
  if ('organization' in input) assign('organization', input.organization ?? null);
  if ('role' in input) assign('role', input.role ?? null);
  if ('cohort' in input) assign('cohort', input.cohort ?? null);
  if ('title' in input) assign('title', input.title ?? null);
  if ('department' in input) assign('department', input.department ?? null);
  if ('location' in input) assign('location', input.location ?? null);
  if ('timezone' in input) assign('timezone', input.timezone ?? null);
  if ('phone' in input) assign('phone', input.phone ?? null);
  if ('language' in input) assign('language', input.language ?? null);
  if ('pronouns' in input) assign('pronouns', input.pronouns ?? null);

  if ('preferences' in input) assign('preferences', toJsonValue(input.preferences, {}));
  if ('accessibilityPrefs' in input || 'accessibility_prefs' in input) {
    assign('accessibility_prefs', toJsonValue(input.accessibilityPrefs ?? input.accessibility_prefs, {}));
  }
  if ('notificationSettings' in input || 'notification_settings' in input) {
    assign('notification_settings', toJsonValue(input.notificationSettings ?? input.notification_settings, {}));
  }

  if ('organizationId' in input || 'organization_id' in input) {
    const orgId = input.organizationId ?? input.organization_id;
    if (!orgId) {
      assign('organization_id', null);
    } else if (opts.allowOrgChange) {
      assign('organization_id', orgId);
    }
  }

  return hasChanges ? payload : null;
};
