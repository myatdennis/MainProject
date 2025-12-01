// Local type shim for packages without @types or those not installed yet
declare module 'cors' {
  import type { RequestHandler } from 'express';
  const cors: ((options?: any) => RequestHandler) & { default?: any };
  export default cors;
}

export {};
