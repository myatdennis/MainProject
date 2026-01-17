export function handleError(error: unknown, context?: string) {
  if (error instanceof Error) {
    console.error(`[Error]${context ? ' [' + context + ']' : ''}:`, error.message);
  } else {
    console.error(`[Error]${context ? ' [' + context + ']' : ''}:`, error);
  }
}
