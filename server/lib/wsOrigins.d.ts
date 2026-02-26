export function isAllowedWsOrigin(
  origin: string | undefined | null,
  options?: { isProduction?: boolean }
): { allowed: boolean; reason: string };