export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait = 300
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, wait);
  };
}
