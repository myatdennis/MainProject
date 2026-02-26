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
  staticOrigins: string[];
  netlifyPreviewPattern: string;
  netlifySuffix: string;
};
