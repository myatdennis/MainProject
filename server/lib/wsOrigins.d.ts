export declare const isAllowedWsOrigin: (
  origin: string | undefined | null,
  options?: { isProduction?: boolean },
) => boolean;

export declare const describeAllowedWsOrigins: () => {
  staticOrigins: string[];
  netlifyPreviewPattern: string;
};
