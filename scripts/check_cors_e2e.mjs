#!/usr/bin/env node
const modPath = new URL('../server/middleware/cors.js', import.meta.url).href;
async function run() {
  delete process.env.E2E_TEST_MODE;
  process.env.NODE_ENV = 'development';
  const mod1 = await import(modPath);
  const headersDefault = (mod1.corsAllowedHeaders || []).map(String).map((h) => String(h).toLowerCase());
  console.log('default includes x-e2e-bypass:', headersDefault.includes('x-e2e-bypass'));

  process.env.E2E_TEST_MODE = 'true';
  const mod2 = await import(modPath + '?r=' + Date.now());
  const headersE2E = (mod2.corsAllowedHeaders || []).map(String).map((h) => String(h).toLowerCase());
  console.log('E2E includes x-e2e-bypass:', headersE2E.includes('x-e2e-bypass'));
}
run().catch((err)=>{ console.error(err); process.exit(1); });
