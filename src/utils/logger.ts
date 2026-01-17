export function log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${ts}] [${level}] ${message}`, context || '');
}
