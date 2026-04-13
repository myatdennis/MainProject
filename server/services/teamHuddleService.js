import { sendError } from '../lib/apiEnvelope.js';

export const TEAM_HUDDLE_TABLES = {
  posts: 'team_huddle_posts',
  comments: 'team_huddle_comments',
  reactions: 'team_huddle_post_reactions',
  reports: 'team_huddle_reports',
};

export const TEAM_HUDDLE_REACTIONS = new Set(['like', 'dislike', 'love']);

export const createTeamHuddleService = ({ e2eStore, createRateLimiter }) => {
  const writeLimiter = createRateLimiter({ tokensPerInterval: 15, intervalMs: 60 * 1000 });

  const sanitizeText = (value, maxLength = 4000) => {
    if (typeof value !== 'string') return '';
    const stripped = value.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return '';
    return stripped.slice(0, maxLength);
  };

  const normalizeTopics = (value) => {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
      .map((topic) => sanitizeText(String(topic || ''), 40).toLowerCase())
      .filter((topic) => {
        if (!topic || seen.has(topic)) return false;
        seen.add(topic);
        return true;
      })
      .slice(0, 8);
  };

  const enforceWriteLimit = (req, res, userId) => {
    const key = `team-huddle:${userId ?? 'anonymous'}:${req.path}`;
    const allowed = writeLimiter(key);
    if (!allowed) {
      sendError(
        res,
        429,
        'team_huddle_rate_limited',
        'You are posting too quickly. Please wait a moment and try again.',
        undefined,
        { requestId: req.requestId ?? null },
      );
      return false;
    }
    return true;
  };

  const buildReactionSummary = (postId) => {
    const summary = { like: 0, dislike: 0, love: 0 };
    const byUser = {};
    for (const reaction of e2eStore.huddleReactions.values()) {
      if (!reaction || reaction.post_id !== postId) continue;
      if (TEAM_HUDDLE_REACTIONS.has(reaction.reaction_type)) {
        summary[reaction.reaction_type] += 1;
      }
      if (reaction.user_id) {
        byUser[reaction.user_id] = reaction.reaction_type;
      }
    }
    return { summary, byUser };
  };

  const listCommentsDemo = (postId) =>
    Array.from(e2eStore.huddleComments.values())
      .filter((comment) => comment.post_id === postId && !comment.deleted_at)
      .sort((a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || ''));

  const listPostsDemo = ({ orgId, includeHidden = false, search = '', topic = '' } = {}) => {
    const searchTerm = String(search || '').trim().toLowerCase();
    const topicTerm = String(topic || '').trim().toLowerCase();
    return Array.from(e2eStore.huddlePosts.values())
      .filter((post) => {
        if (!post || post.organization_id !== orgId) return false;
        if (post.deleted_at) return false;
        if (!includeHidden && post.hidden_at) return false;
        if (topicTerm && !(Array.isArray(post.topics) && post.topics.includes(topicTerm))) return false;
        if (!searchTerm) return true;
        const haystack = `${post.title || ''} ${post.body || ''} ${(post.topics || []).join(' ')}`.toLowerCase();
        return haystack.includes(searchTerm);
      })
      .sort((a, b) => {
        if (a.pinned_at && !b.pinned_at) return -1;
        if (!a.pinned_at && b.pinned_at) return 1;
        return Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
      });
  };

  const mapPostEnvelope = (post, { includeComments = false, viewerUserId = null } = {}) => {
    const { summary, byUser } = buildReactionSummary(post.id);
    const comments = includeComments ? listCommentsDemo(post.id) : [];
    return {
      ...post,
      reactionSummary: summary,
      viewerReaction: viewerUserId ? byUser[viewerUserId] ?? null : null,
      commentCount: includeComments
        ? comments.length
        : Array.from(e2eStore.huddleComments.values()).filter((item) => item.post_id === post.id && !item.deleted_at).length,
      comments,
    };
  };

  const applyModerationMutation = (post, action, userId) => {
    const nowIso = new Date().toISOString();
    const next = { ...post, updated_at: nowIso };
    if (action === 'hide') {
      next.hidden_at = nowIso;
      next.hidden_by_user_id = userId;
    }
    if (action === 'unhide') {
      next.hidden_at = null;
      next.hidden_by_user_id = null;
    }
    if (action === 'lock') {
      next.locked_at = nowIso;
      next.locked_by_user_id = userId;
    }
    if (action === 'unlock') {
      next.locked_at = null;
      next.locked_by_user_id = null;
    }
    if (action === 'pin') {
      next.pinned_at = nowIso;
      next.pinned_by_user_id = userId;
    }
    if (action === 'unpin') {
      next.pinned_at = null;
      next.pinned_by_user_id = null;
    }
    if (action === 'remove') {
      next.deleted_at = nowIso;
    }
    return next;
  };

  return {
    sanitizeText,
    normalizeTopics,
    enforceWriteLimit,
    listCommentsDemo,
    listPostsDemo,
    mapPostEnvelope,
    applyModerationMutation,
  };
};

export default createTeamHuddleService;
