declare module 'cors' {
  import type { RequestHandler } from 'express';
  function cors(options?: any): RequestHandler;
  namespace cors {}
  export = cors;
}
