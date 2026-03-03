const CSRF_COOKIE_NAME = 'csrf_token';

const readDocumentCookies = (): string[] => {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string' || !document.cookie) {
    return [];
  }
  return document.cookie.split(';');
};

export function getCSRFCookie(): string | null {
  try {
    const cookies = readDocumentCookies();
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === CSRF_COOKIE_NAME) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getCSRFToken(): string | null {
  return getCSRFCookie();
}

export { CSRF_COOKIE_NAME };
