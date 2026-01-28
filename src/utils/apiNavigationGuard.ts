type BlockReason = 'anchor' | 'form';

const warnBlockedNavigation = (kind: BlockReason, href: string) => {
  console.warn(
    `[api-navigation-guard] Blocked ${kind} navigation to ${href}. Use apiRequest/apiClient instead of linking directly to API routes.`,
  );
};

const shouldBlockHref = (href: string | null | undefined) => {
  if (!href) return false;
  return href.startsWith('/api/');
};

export function registerApiNavigationGuard() {
  if (typeof document === 'undefined') return;

  const clickHandler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (shouldBlockHref(href)) {
      event.preventDefault();
      event.stopPropagation();
      warnBlockedNavigation('anchor', href || '/api');
    }
  };

  const submitHandler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const form = target.closest('form[action]') as HTMLFormElement | null;
    if (!form) return;

    const action = form.getAttribute('action');
    if (shouldBlockHref(action)) {
      event.preventDefault();
      event.stopPropagation();
      warnBlockedNavigation('form', action || '/api');
    }
  };

  document.addEventListener('click', clickHandler, true);
  document.addEventListener('auxclick', clickHandler, true);
  document.addEventListener('submit', submitHandler, true);
}

export default registerApiNavigationGuard;
