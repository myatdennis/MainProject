import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../utils/requestContext', () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue({
    'X-User-Id': 'test-user',
    'X-User-Role': 'member'
  })
}));
vi.mock('../../utils/apiClient', () => {
  return {
    __esModule: true,
    default: vi.fn()
  };
});

import {
  getWorkspace,
  addActionItem,
  addStrategicPlanVersion
} from '../clientWorkspaceService';
import apiRequest from '../../utils/apiClient';

describe('clientWorkspaceService', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.clearAllMocks();
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

    vi.mocked(apiRequest).mockResolvedValue(response);

    const workspace = await getWorkspace('org-123');

    expect(apiRequest).toHaveBeenCalledWith('/api/orgs/org-123/workspace', { noTransform: true });
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

    vi.mocked(apiRequest).mockResolvedValue(response);

    const created = await addStrategicPlanVersion('org-abc', 'Updated strategy', 'Taylor', { version: 2 });

    expect(apiRequest).toHaveBeenCalledWith('/api/orgs/org-abc/workspace/strategic-plans', {
      noTransform: true,
      method: 'POST',
      body: { content: 'Updated strategy', createdBy: 'Taylor', metadata: { version: 2 } }
    });
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

    vi.mocked(apiRequest).mockResolvedValue(response);

    const created = await addActionItem('org-xyz', {
      orgId: 'org-xyz',
      title: 'Draft follow-up',
      status: 'Not Started'
    } as any);

    expect(apiRequest).toHaveBeenCalledWith('/api/orgs/org-xyz/workspace/action-items', {
      noTransform: true,
      method: 'POST',
      body: {
        title: 'Draft follow-up',
        description: undefined,
        assignee: undefined,
        dueDate: undefined,
        status: 'Not Started',
        metadata: undefined
      }
    });
    expect(created.id).toBe('action-77');
    expect(created.title).toBe('Draft follow-up');
  });
});
