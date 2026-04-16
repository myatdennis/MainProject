import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAuthHeaders, createAdminAuthHeaders, startTestServer, stopTestServer, type TestServerHandle } from './utils/server.ts';

const DEMO_ORG_ID = 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';

const jsonHeaders = async (headers: Record<string, string>) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  ...headers,
});

describe('Admin documents create flow', () => {
  let server: TestServerHandle | null = null;
  let platformAdminHeaders: Record<string, string> = {};
  let orgAdminHeaders: Record<string, string> = {};
  let learnerHeaders: Record<string, string> = {};

  beforeAll(async () => {
    server = await startTestServer();
    platformAdminHeaders = await createAdminAuthHeaders({ email: 'mya@the-huddle.co' });
    orgAdminHeaders = await buildAuthHeaders({
      email: 'org-admin-docs@local',
      role: 'admin',
      platformRole: null,
      organization_ids: [DEMO_ORG_ID],
      app_metadata: {
        memberships: [{ orgId: DEMO_ORG_ID, role: 'admin', status: 'active' }],
      },
    } as any);
    learnerHeaders = await buildAuthHeaders({
      userId: '00000000-0000-0000-0000-000000000003',
      email: 'learner-docs@local',
      role: 'member',
      platformRole: null,
      organization_ids: [DEMO_ORG_ID],
      app_metadata: {
        memberships: [{ orgId: DEMO_ORG_ID, role: 'member', status: 'active' }],
      },
    } as any);
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  const parseJson = async (res: Response) => res.json().catch(() => ({}));

  const uploadDocument = async (
    headers: Record<string, string>,
    { organizationId = DEMO_ORG_ID, failHeader }: { organizationId?: string; failHeader?: string } = {},
  ) => {
    const form = new FormData();
    form.append('file', new Blob(['test document body'], { type: 'text/plain' }), 'welcome.txt');
    form.append('documentId', `doc_${Date.now()}`);
    if (organizationId) form.append('organization_id', organizationId);
    form.append('visibility', 'org');
    return server!.fetch('/api/admin/documents/upload', {
      method: 'POST',
      headers: {
        ...headers,
        ...(failHeader ? { 'x-test-documents-fail': failHeader } : {}),
      },
      body: form as any,
    });
  };

  it('creates a document successfully with valid org and file and returns canonical payload', async () => {
    const uploadRes = await uploadDocument(orgAdminHeaders);
    const uploadBody = await parseJson(uploadRes as any);
    expect(uploadRes.status).toBe(201);
    expect(uploadBody?.data?.storagePath).toBeTruthy();
    expect(uploadBody?.data?.organizationId).toBe(DEMO_ORG_ID);

    const createRes = await server!.fetch('/api/admin/documents', {
      method: 'POST',
      headers: await jsonHeaders(orgAdminHeaders),
      body: JSON.stringify({
        name: 'Welcome Packet',
        category: 'Onboarding',
        visibility: 'org',
        organization_id: DEMO_ORG_ID,
        storagePath: uploadBody.data.storagePath,
        url: uploadBody.data.signedUrl,
        urlExpiresAt: uploadBody.data.urlExpiresAt,
        fileType: uploadBody.data.fileType,
        fileSize: uploadBody.data.fileSize,
        filename: 'welcome.txt',
        tags: ['welcome'],
      }),
    });
    const createBody = await parseJson(createRes as any);
    expect(createRes.status).toBe(201);
    expect(createBody?.data).toMatchObject({
      name: 'Welcome Packet',
      category: 'Onboarding',
      visibility: 'org',
      organization_id: DEMO_ORG_ID,
    });
    expect(createBody?.data?.id).toBeTruthy();

    const listRes = await server!.fetch(`/api/admin/documents?orgId=${DEMO_ORG_ID}`, {
      headers: { Accept: 'application/json', ...orgAdminHeaders },
    });
    const listBody = await parseJson(listRes as any);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listBody?.data)).toBe(true);
    expect(listBody.data.some((doc: any) => doc.id === createBody.data.id)).toBe(true);
  });

  it('makes org-scoped documents visible to learners in the same organization', async () => {
    const uploadRes = await uploadDocument(orgAdminHeaders);
    const uploadBody = await parseJson(uploadRes as any);
    expect(uploadRes.status).toBe(201);

    const createRes = await server!.fetch('/api/admin/documents', {
      method: 'POST',
      headers: await jsonHeaders(orgAdminHeaders),
      body: JSON.stringify({
        name: 'Learner Visible Resource',
        category: 'Resources',
        visibility: 'org',
        organization_id: DEMO_ORG_ID,
        storagePath: uploadBody.data.storagePath,
        url: uploadBody.data.signedUrl,
        urlExpiresAt: uploadBody.data.urlExpiresAt,
        filename: 'welcome.txt',
      }),
    });
    const createBody = await parseJson(createRes as any);
    expect(createRes.status).toBe(201);

    const learnerListRes = await server!.fetch(`/api/client/documents?orgId=${DEMO_ORG_ID}`, {
      headers: { Accept: 'application/json', ...learnerHeaders },
    });
    const learnerListBody = await parseJson(learnerListRes as any);
    expect(learnerListRes.status).toBe(200);
    expect(Array.isArray(learnerListBody?.data)).toBe(true);
    expect(learnerListBody.data.some((doc: any) => doc.id === createBody.data.id)).toBe(true);
  });

  it('returns 400 when org scope is ambiguous and no organizationId is provided', async () => {
    const ambiguousHeaders = await buildAuthHeaders({
      email: 'platform-admin-docs@local',
      role: 'admin',
      platformRole: 'platform_admin',
      organization_ids: [DEMO_ORG_ID, '3f48d198-c3dd-4afb-b443-6257c8046d2f'],
      app_metadata: {
        organization_ids: [DEMO_ORG_ID, '3f48d198-c3dd-4afb-b443-6257c8046d2f'],
      },
    } as any);

    const res = await server!.fetch('/api/admin/documents', {
      method: 'POST',
      headers: await jsonHeaders(ambiguousHeaders),
      body: JSON.stringify({
        name: 'Ambiguous document',
        category: 'Policy',
        visibility: 'global',
      }),
    });
    const body = await parseJson(res as any);
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      code: 'explicit_org_selection_required',
      error: {
        code: 'explicit_org_selection_required',
      },
    });
  });

  it('returns 403 instead of 500 for unauthorized organization scope', async () => {
    const res = await server!.fetch('/api/admin/documents', {
      method: 'POST',
      headers: await jsonHeaders(orgAdminHeaders),
      body: JSON.stringify({
        name: 'Forbidden document',
        category: 'Policy',
        visibility: 'org',
        organization_id: 'forbidden-org',
      }),
    });
    const body = await parseJson(res as any);
    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: 'org_access_denied',
      error: {
        code: 'org_access_denied',
      },
    });
  });

  it('returns 400 for missing file uploads', async () => {
    const form = new FormData();
    form.append('organization_id', DEMO_ORG_ID);
    const res = await server!.fetch('/api/admin/documents/upload', {
      method: 'POST',
      headers: orgAdminHeaders,
      body: form as any,
    });
    const body = await parseJson(res as any);
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      code: 'validation_failed',
      error: {
        code: 'validation_failed',
      },
    });
  });

  it('returns a truthful storage error when the upload step fails', async () => {
    const res = await uploadDocument(orgAdminHeaders, { failHeader: 'storage' });
    const body = await parseJson(res as any);
    expect(res.status).toBe(502);
    expect(body).toMatchObject({
      code: 'document_storage_upload_failed',
      error: {
        code: 'document_storage_upload_failed',
      },
    });
  });

  it('returns a truthful metadata error when the db insert step fails', async () => {
    const uploadRes = await uploadDocument(orgAdminHeaders);
    const uploadBody = await parseJson(uploadRes as any);
    expect(uploadRes.status).toBe(201);

    const createRes = await server!.fetch('/api/admin/documents', {
      method: 'POST',
      headers: await jsonHeaders({
        ...orgAdminHeaders,
        'x-test-documents-fail': 'db',
      }),
      body: JSON.stringify({
        name: 'Broken metadata document',
        category: 'Policy',
        visibility: 'org',
        organization_id: DEMO_ORG_ID,
        storagePath: uploadBody.data.storagePath,
        url: uploadBody.data.signedUrl,
      }),
    });
    const createBody = await parseJson(createRes as any);
    expect(createRes.status).toBeGreaterThanOrEqual(500);
    expect(createBody).toMatchObject({
      code: 'document_create_failed',
      error: {
        code: 'document_create_failed',
      },
    });
    expect(createBody?.error?.message).not.toBe('Unable to create document');
  });
});
