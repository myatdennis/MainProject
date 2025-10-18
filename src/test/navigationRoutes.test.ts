import { describe, expect, it } from 'vitest';
import { ADMIN_NAVIGATION_LINKS } from '../components/Admin/AdminLayout';
import { LMS_NAVIGATION_LINKS } from '../components/LMS/LMSLayout';
import { isValidRoutePath } from '../routes/routeManifest';

const collectInvalidLinks = (links: readonly { href: string; name: string }[]) =>
  links.filter(link => !isValidRoutePath(link.href)).map(link => `${link.name} → ${link.href}`);

describe('Navigation link integrity', () => {
  it('maps every admin navigation link to a valid route', () => {
    const invalidLinks = collectInvalidLinks(ADMIN_NAVIGATION_LINKS);
    expect(invalidLinks).toEqual([]);
  });

  it('maps every LMS navigation link to a valid route', () => {
    const invalidLinks = collectInvalidLinks(LMS_NAVIGATION_LINKS);
    expect(invalidLinks).toEqual([]);
  });
});
