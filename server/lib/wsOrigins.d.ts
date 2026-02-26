export type WsOriginDecision =
  | { allowed: true; reason: 'static_allowlist' | 'netlify_preview' | 'netlify_any' | 'local_dev' }
  | { allowed: false; reason: 'missing_origin' | 'not_allowed' };

export type WsOriginResult = WsOriginDecision;

export type WsOriginOptions = {
  isProduction?: boolean;
};

export declare function isAllowedWsOrigin(
  origin: string | null | undefined,
  options?: WsOriginOptions,
): WsOriginDecision;

export declare function describeAllowedWsOrigins(): {
  staticOrigins: string[];
  netlifyPreviewPattern: string;
  netlifySuffix: string;
};
