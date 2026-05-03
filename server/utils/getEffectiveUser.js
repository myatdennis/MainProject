export function getEffectiveUser(req) {
  if (!req) return null;
  const canonical = req.user || null;
  if (!canonical) return null;
  const elevation = req.adminElevation || {};
  const merged = Object.assign({}, canonical, elevation);
  const resolvedUserId = merged.userId || merged.id || null;
  if (resolvedUserId) {
    merged.userId = resolvedUserId;
    merged.id = merged.id || resolvedUserId;
  }
  return Object.freeze(merged);
}
