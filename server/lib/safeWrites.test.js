import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSupabaseAdminClient = vi.fn();
vi.mock('./supabaseClient.js', () => ({
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

// db.js does its own DB connection setup at import time; not needed here.
vi.mock('../db.js', () => ({ default: {} }));

const { safeDelete, safeUpsert } = await import('./safeWrites.js');

const makeFakeUpsertClient = () => {
  const upsertResult = (payload) => {
    const promise = Promise.resolve({ data: payload, error: null });
    promise.select = vi.fn(() => Promise.resolve({ data: payload, error: null }));
    return promise;
  };
  const table = { upsert: vi.fn((payload) => upsertResult(payload)) };
  return { from: vi.fn(() => table), table };
};

// Mimics the real PostgREST chain: .from(table) has no filter methods of its
// own; .delete() returns a builder that has them (.eq, .contains, ...) and is
// itself awaitable (thenable), resolving once a filter is applied.
const createFakeSupabaseClient = () => {
  const calls = [];
  const filterBuilder = {
    eq: vi.fn((col, val) => {
      calls.push(['eq', col, val]);
      return Promise.resolve({ data: null, error: null, calls });
    }),
    contains: vi.fn((col, val) => {
      calls.push(['contains', col, val]);
      return Promise.resolve({ data: null, error: null, calls });
    }),
  };
  const table = {
    delete: vi.fn(() => filterBuilder),
  };
  return { from: vi.fn(() => table), table, filterBuilder };
};

describe('safeDelete', () => {
  beforeEach(() => {
    mockGetSupabaseAdminClient.mockReset();
  });

  it('calls .delete() before applying the predicate filter (matches real PostgREST chain order)', async () => {
    const client = createFakeSupabaseClient();
    mockGetSupabaseAdminClient.mockReturnValue(client);

    const result = await safeDelete('survey_assignments', (q) => q.eq('survey_id', 'abc-123'));

    expect(client.from).toHaveBeenCalledWith('survey_assignments');
    expect(client.table.delete).toHaveBeenCalled();
    expect(client.filterBuilder.eq).toHaveBeenCalledWith('survey_id', 'abc-123');
    expect(result.calls).toEqual([['eq', 'survey_id', 'abc-123']]);
  });

  it('supports .contains() predicates the same way', async () => {
    const client = createFakeSupabaseClient();
    mockGetSupabaseAdminClient.mockReturnValue(client);

    await safeDelete('survey_assignments', (q) => q.contains('user_ids', ['user-1']));

    expect(client.filterBuilder.contains).toHaveBeenCalledWith('user_ids', ['user-1']);
  });

  it('throws when no admin client is configured', async () => {
    mockGetSupabaseAdminClient.mockReturnValue(null);
    await expect(safeDelete('surveys', (q) => q.eq('id', '1'))).rejects.toThrow(/admin client/i);
  });
});

describe('safeUpsert', () => {
  beforeEach(() => {
    mockGetSupabaseAdminClient.mockReset();
  });

  it('throws an invariant error instead of silently nulling a required column on an "assign" table', async () => {
    const client = makeFakeUpsertClient();
    mockGetSupabaseAdminClient.mockReturnValue(client);

    // Missing organization_id/assignment_type — exactly the shape that
    // previously reached Postgres as a NOT NULL violation instead of being
    // caught here.
    await expect(
      safeUpsert('assignments', [{ id: 'row-1', active: false }]),
    ).rejects.toThrow(/invariant failed/i);
    expect(client.table.upsert).not.toHaveBeenCalled();
  });

  it('proceeds normally when the payload carries the required assignment columns', async () => {
    const client = makeFakeUpsertClient();
    mockGetSupabaseAdminClient.mockReturnValue(client);

    const result = await safeUpsert('assignments', [
      { id: 'row-1', organization_id: 'org-1', assignment_type: 'course', active: false },
    ]);

    expect(client.table.upsert).toHaveBeenCalled();
    expect(result.data).toEqual([{ id: 'row-1', organization_id: 'org-1', assignment_type: 'course', active: false }]);
  });

  it('does not apply the assignment invariant check to non-"assign" tables', async () => {
    const client = makeFakeUpsertClient();
    mockGetSupabaseAdminClient.mockReturnValue(client);

    await expect(safeUpsert('courses', [{ id: 'course-1', title: 'x' }])).resolves.toBeDefined();
    expect(client.table.upsert).toHaveBeenCalled();
  });
});
