import { afterEach, describe, expect, it, vi } from 'vitest';

describe('orgService request dedupe', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('collapses concurrent organization list reads into one API request', async () => {
    const apiRequestMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'org-1',
          name: 'Org One',
          type: 'company',
          status: 'active',
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, hasMore: false },
    });

    vi.doMock('../../utils/apiClient', () => ({
      __esModule: true,
      default: apiRequestMock,
      ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
          super(message);
          this.status = status;
        }
      },
    }));
    vi.doMock('../../config/apiBase', () => ({
      resolveApiUrl: (path: string) => `http://localhost${path}`,
    }));
    vi.doMock('../../utils/adminOrgScope', () => ({
      appendAdminOrgIdQuery: (path: string) => `${path}${path.includes('?') ? '&' : '?'}orgId=org-1`,
      requireExplicitAdminOrgId: () => 'org-1',
    }));

    const { listOrgPage } = await import('../orgService');

    const [first, second] = await Promise.all([
      listOrgPage({ page: 1, pageSize: 25 }),
      listOrgPage({ page: 1, pageSize: 25 }),
    ]);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith('/api/admin/organizations?page=1&pageSize=25&orgId=org-1');
    expect(first.data).toHaveLength(1);
    expect(second.data[0]?.id).toBe('org-1');
  });

  it('fails before dispatch when explicit admin org scope is missing', async () => {
    const apiRequestMock = vi.fn();

    vi.doMock('../../utils/apiClient', () => ({
      __esModule: true,
      default: apiRequestMock,
      ApiError: class ApiError extends Error {},
    }));
    vi.doMock('../../config/apiBase', () => ({
      resolveApiUrl: (path: string) => `http://localhost${path}`,
    }));
    vi.doMock('../../utils/adminOrgScope', async () => {
      const actual = await vi.importActual<typeof import('../../utils/adminOrgScope')>('../../utils/adminOrgScope');
      return {
        ...actual,
        appendAdminOrgIdQuery: (path: string) => path,
        requireExplicitAdminOrgId: () => {
          const error = new Error('Organization context is required for admin organizations.');
          (error as Error & { code?: string }).code = 'org_id_required';
          throw error;
        },
      };
    });

    const { listOrgPage } = await import('../orgService');

    await expect(listOrgPage({ page: 1, pageSize: 25 })).rejects.toThrow(
      'Organization context is required for admin organizations.',
    );
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
