import { describe, expect, it } from 'vitest';
import { createTeamHuddleService } from '../teamHuddleService.js';

const createStore = () => ({
  huddlePosts: new Map(),
  huddleComments: new Map(),
  huddleReactions: new Map(),
  huddleReports: new Map(),
});

describe('teamHuddleService', () => {
  it('normalizes and de-duplicates topics', () => {
    const service = createTeamHuddleService({
      e2eStore: createStore(),
      createRateLimiter: () => () => true,
    });

    expect(service.normalizeTopics([' Leadership ', 'leadership', '<b>Trust</b>', '', null])).toEqual([
      'leadership',
      'trust',
    ]);
  });

  it('maps demo post envelope with reaction summary and comment count', () => {
    const e2eStore = createStore();
    e2eStore.huddleComments.set('comment-1', {
      id: 'comment-1',
      post_id: 'post-1',
      body: 'First comment',
      created_at: '2026-04-11T10:00:00.000Z',
    });
    e2eStore.huddleReactions.set('post-1:user-1', {
      id: 'reaction-1',
      post_id: 'post-1',
      user_id: 'user-1',
      reaction_type: 'love',
    });

    const service = createTeamHuddleService({
      e2eStore,
      createRateLimiter: () => () => true,
    });

    const envelope = service.mapPostEnvelope(
      { id: 'post-1', title: 'Hello', body: 'World' },
      { viewerUserId: 'user-1' },
    );

    expect(envelope.commentCount).toBe(1);
    expect(envelope.viewerReaction).toBe('love');
    expect(envelope.reactionSummary).toEqual({ like: 0, dislike: 0, love: 1 });
  });
});
