import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  createAdminAuthHeaders,
  startTestServer,
  stopTestServer,
  type TestServerHandle,
} from './utils/server.ts';

const TEST_ORG_ID = process.env.TEST_ORGANIZATION_ID || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';
const TEST_ADMIN_ID = process.env.TEST_PLATFORM_ADMIN_ID || '00000000-0000-0000-0000-000000000001';
const DB_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_POOLER_URL ||
  process.env.SUPABASE_DB_URL ||
  null;

const withAdminHeaders = async () => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'x-org-id': TEST_ORG_ID,
  'x-user-id': TEST_ADMIN_ID,
  'x-user-role': 'admin',
  ...(await createAdminAuthHeaders()),
});

describe.skipIf(!DB_URL)('Team Huddle schema + API contract', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer({ idempotencyFallback: false });
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('has canonical Team Huddle tables in public schema', async () => {
    const client = new Client({ connectionString: DB_URL!, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const tableResult = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'team_huddle_posts',
            'team_huddle_comments',
            'team_huddle_post_reactions',
            'team_huddle_reports'
          )
      `,
    );

    const tables = new Set(tableResult.rows.map((row) => row.table_name));
    expect(tables.has('team_huddle_posts')).toBe(true);
    expect(tables.has('team_huddle_comments')).toBe(true);
    expect(tables.has('team_huddle_post_reactions')).toBe(true);
    expect(tables.has('team_huddle_reports')).toBe(true);

    await client.end();
  });

  it('supports feed + create post + comment + reaction without PGRST205', async () => {
    const headers = await withAdminHeaders();

    const feedRes = await server!.fetch('/api/team-huddle/posts?limit=5', { headers });
    const feedBody = await feedRes.text();
    expect(feedRes.status, feedBody).toBe(200);
    expect(feedBody.includes('PGRST205')).toBe(false);

    const createPostRes = await server!.fetch('/api/team-huddle/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organization_id: TEST_ORG_ID,
        title: `Integration Team Huddle ${Date.now()}`,
        body: `Post body ${randomUUID()}`,
        topics: ['integration', 'schema'],
      }),
    });
    const createPostText = await createPostRes.text();
    expect(createPostRes.status, createPostText).toBe(201);
    expect(createPostText.includes('PGRST205')).toBe(false);

    const createdPost = JSON.parse(createPostText)?.data;
    expect(createdPost?.id).toBeTruthy();

    const commentRes = await server!.fetch(`/api/team-huddle/posts/${encodeURIComponent(createdPost.id)}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: 'Integration comment from test' }),
    });
    const commentText = await commentRes.text();
    expect(commentRes.status, commentText).toBe(201);
    expect(commentText.includes('PGRST205')).toBe(false);

    const reactionRes = await server!.fetch(`/api/team-huddle/posts/${encodeURIComponent(createdPost.id)}/reactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reactionType: 'like' }),
    });
    const reactionText = await reactionRes.text();
    expect(reactionRes.status, reactionText).toBe(200);
    expect(reactionText.includes('PGRST205')).toBe(false);

    const detailRes = await server!.fetch(`/api/team-huddle/posts/${encodeURIComponent(createdPost.id)}`, { headers });
    const detailText = await detailRes.text();
    expect(detailRes.status, detailText).toBe(200);
    expect(detailText.includes('PGRST205')).toBe(false);
  });
});
