import { describe, it, expect } from 'vitest';
import { apiRequest as rawApiRequest } from '../../utils/apiClient';
const g = globalThis;
describe('apiClient case transforms', () => {
    it('converts outgoing camelCase JSON to snake_case', async () => {
        const bodySeen = [];
        const originalFetch = g.fetch;
        g.fetch = async (_url, init) => {
            const body = init?.body;
            bodySeen.push(JSON.parse(body));
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
        };
        try {
            await rawApiRequest('/dummy', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ moduleId: 'abc', orderIndex: 2, content: { type: 'text', body: { keepThisKey: true } } }),
            });
            expect(bodySeen[0]).toHaveProperty('module_id', 'abc');
            expect(bodySeen[0]).toHaveProperty('order_index', 2);
            // Ensure content.body not transformed
            expect(bodySeen[0].content.body).toHaveProperty('keepThisKey', true);
        }
        finally {
            g.fetch = originalFetch;
        }
    });
    it('converts incoming snake_case JSON to camelCase', async () => {
        const originalFetch = g.fetch;
        g.fetch = async (_url, _init) => {
            return new Response(JSON.stringify({ data: { module_id: 'm1', order_index: 3, content_json: { type: 'text', body: { keep_this_key: true } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
        };
        try {
            const resp = await rawApiRequest('/dummy');
            expect(resp.data).toHaveProperty('moduleId', 'm1');
            expect(resp.data).toHaveProperty('orderIndex', 3);
            // content_json key stays as-is, but nested keys should not be force converted due to skip
            expect(resp.data).toHaveProperty('content_json');
            expect(resp.data.content_json.body).toHaveProperty('keep_this_key', true);
        }
        finally {
            g.fetch = originalFetch;
        }
    });
});
