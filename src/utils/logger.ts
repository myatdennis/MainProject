export function log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
  const ts = new Date().toISOString();
  const formattedMessage = `[${ts}] [${level}] ${message}`;
  if (level === 'error') {
    console.error(formattedMessage, context || '');
    return;
  }
  if (level === 'warn') {
    console.warn(formattedMessage, context || '');
    return;
  }
  if (import.meta.env.DEV) {
    console.info(formattedMessage, context || '');
  }
}
