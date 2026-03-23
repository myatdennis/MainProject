/// <reference types="vite/client" />

// Injected by vite.config.ts define — ISO timestamp of the build.
// Used by main.tsx to print [BUILD_VERSION] on startup for stale-bundle detection.
declare const __APP_BUILD_TIME__: string;
