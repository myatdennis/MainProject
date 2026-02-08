export function log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${message}`, context || '');
}
