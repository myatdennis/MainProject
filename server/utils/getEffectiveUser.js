export function getEffectiveUser(req) {
  if (!req) return null;
  const canonical = req.user || null;
  if (!canonical) return null;
  const elevation = req.adminElevation || {};
  return Object.freeze(Object.assign({}, canonical, elevation));
}
