import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../../utils/requestContext', () => ({
    __esModule: true,
    default: vi.fn().mockResolvedValue({
        'X-User-Id': 'test-user',
        'X-User-Role': 'member'
    })
}));
import { getWorkspace, addActionItem, addStrategicPlanVersion } from '../clientWorkspaceService';
// Helper to mock fetch responses
const mockFetchJson = (payload) => vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload
});
describe('clientWorkspaceService', () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        global.fetch = originalFetch;
    });
    it('maps workspace payloads from the API', async () => {
        const response = {
            data: {
                orgId: 'org-123',
                strategicPlans: [
                    { id: 'sp-1', org_id: 'org-123', content: '# Plan', created_at: '2025-01-02T00:00:00.000Z', created_by: 'Alex' }
                ],
                sessionNotes: [
                    {
                        id: 'note-1',
                        org_id: 'org-123',
                        title: 'Retro',
                        body: 'Discussed wins',
                        note_date: '2025-01-05T12:00:00.000Z',
                        tags: ['retro'],
                        attachments: [],
                        created_by: 'Jordan',
                        created_at: '2025-01-05T12:05:00.000Z'
                    }
                ],
                actionItems: [
                    {
                        id: 'action-1',
                        org_id: 'org-123',
                        title: 'Follow up',
                        description: 'Send summary',
                        status: 'In Progress',
                        due_at: '2025-01-10T00:00:00.000Z',
                        metadata: { priority: 'medium' }
                    }
                ]
            }
        };
        global.fetch = mockFetchJson(response);
        const workspace = await getWorkspace('org-123');
        const [requestUrl, requestInit] = global.fetch.mock.calls[0];
        expect(requestUrl).toContain('/api/orgs/org-123/workspace');
        const headers = requestInit.headers;
        expect(headers.get('X-User-Id')).toBe('test-user');
        expect(headers.get('X-User-Role')).toBe('member');
        expect(workspace.orgId).toBe('org-123');
        expect(workspace.strategicPlans[0]).toMatchObject({
            id: 'sp-1',
            content: '# Plan',
            createdAt: '2025-01-02T00:00:00.000Z',
            createdBy: 'Alex'
        });
        expect(workspace.sessionNotes[0]).toMatchObject({
            id: 'note-1',
            title: 'Retro',
            tags: ['retro'],
            createdBy: 'Jordan'
        });
        expect(workspace.actionItems[0]).toMatchObject({
            id: 'action-1',
            status: 'In Progress',
            dueDate: '2025-01-10T00:00:00.000Z'
        });
    });
    it('posts strategic plan versions to the API', async () => {
        const response = {
            data: {
                id: 'sp-55',
                org_id: 'org-abc',
                content: 'Updated strategy',
                created_at: '2025-03-01T09:30:00.000Z',
                created_by: 'Taylor'
            }
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => response
        });
        global.fetch = fetchMock;
        const created = await addStrategicPlanVersion('org-abc', 'Updated strategy', 'Taylor', { version: 2 });
        const [requestUrl, requestInit] = fetchMock.mock.calls[0];
        expect(requestUrl).toContain('/api/orgs/org-abc/workspace/strategic-plans');
        expect(requestInit.method).toBe('POST');
        expect(requestInit.body).toBe(JSON.stringify({ content: 'Updated strategy', createdBy: 'Taylor', metadata: { version: 2 } }));
        const headers = requestInit.headers;
        expect(headers.get('X-User-Id')).toBe('test-user');
        expect(headers.get('X-User-Role')).toBe('member');
        expect(created).toMatchObject({
            id: 'sp-55',
            orgId: 'org-abc',
            createdBy: 'Taylor'
        });
    });
    it('creates action items via the API', async () => {
        const response = {
            data: {
                id: 'action-77',
                org_id: 'org-xyz',
                title: 'Draft follow-up',
                status: 'Not Started',
                assignee: 'Jordan',
                due_at: null,
                metadata: {}
            }
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => response
        });
        global.fetch = fetchMock;
        const created = await addActionItem('org-xyz', {
            orgId: 'org-xyz',
            title: 'Draft follow-up',
            status: 'Not Started'
        });
        const [requestUrl, requestInit] = fetchMock.mock.calls[0];
        expect(requestUrl).toContain('/api/orgs/org-xyz/workspace/action-items');
        expect(requestInit.method).toBe('POST');
        const headers = requestInit.headers;
        expect(headers.get('X-User-Id')).toBe('test-user');
        expect(headers.get('X-User-Role')).toBe('member');
        expect(created.id).toBe('action-77');
        expect(created.title).toBe('Draft follow-up');
    });
});
