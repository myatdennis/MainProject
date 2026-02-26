<<<<<<< HEAD
export interface WsOriginResult {
  allowed: boolean;
  reason: 'static_allowlist' | 'netlify_preview' | 'netlify_any' | 'local_dev' | 'missing_origin' | 'not_allowed';
}

export interface WsOriginOptions {
  isProduction?: boolean;
}

export function isAllowedWsOrigin(
  origin: string | undefined | null,
  options?: WsOriginOptions,
): WsOriginResult;

export function describeAllowedWsOrigins(): {
=======
export type WsOriginDecision =
  | { allowed: true; reason: 'static_allowlist' | 'netlify_preview' | 'netlify_any' | 'local_dev' }
  | { allowed: false; reason: 'missing_origin' | 'not_allowed' };

export declare function isAllowedWsOrigin(
  origin: string | null | undefined,
  options?: { isProduction?: boolean },
): WsOriginDecision;

export declare function describeAllowedWsOrigins(): {
>>>>>>> a6944c9 (ddqdq)
  staticOrigins: string[];
  netlifyPreviewPattern: string;
  netlifySuffix: string;
};
