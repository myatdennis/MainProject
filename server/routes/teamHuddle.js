import express from 'express';
import { hasOrgAdminRole } from '../middleware/auth.js';
import { sendError, sendOk } from '../lib/apiEnvelope.js';
import { createTeamHuddleService, TEAM_HUDDLE_REACTIONS, TEAM_HUDDLE_TABLES } from '../services/teamHuddleService.js';

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export const createTeamHuddleRouter = ({
  supabase,
  e2eStore,
  persistE2EStore,
  notificationService,
  isDemoOrTestMode,
  ensureTablesReady,
  respondSchemaUnavailable,
  requireUserContext,
  requireOrgAccess,
  resolveOrgScopeFromRequest,
  normalizeOrgIdValue,
  clampNumber,
  sanitizeIlike,
  randomUUID,
  createRateLimiter,
}) => {
  const router = express.Router({ mergeParams: true });
  const service = createTeamHuddleService({ e2eStore, createRateLimiter });

  const ensureReadiness = async () => {
    if (!supabase) return { ok: true };
    return ensureTablesReady('team_huddle', [
      { table: TEAM_HUDDLE_TABLES.posts, columns: ['id', 'organization_id', 'title', 'body', 'user_id', 'created_at'] },
      { table: TEAM_HUDDLE_TABLES.comments, columns: ['id', 'post_id', 'organization_id', 'body', 'user_id', 'created_at'] },
      { table: TEAM_HUDDLE_TABLES.reactions, columns: ['id', 'post_id', 'organization_id', 'user_id', 'reaction_type'] },
      { table: TEAM_HUDDLE_TABLES.reports, columns: ['id', 'post_id', 'organization_id', 'reporter_user_id', 'reason'] },
    ]);
  };

  router.get('/team-huddle/posts', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    if (orgScope.requiresExplicitSelection || !orgScope.orgId) {
      return sendError(res, 400, 'org_required', 'Select an organization to view Team Huddle posts.');
    }
    const access = await requireOrgAccess(req, res, orgScope.orgId, { write: false });
    if (!access) return;

    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const topic = typeof req.query.topic === 'string' ? req.query.topic : '';
    const includeHidden = String(req.query.includeHidden || '').toLowerCase() === 'true' && hasOrgAdminRole(access.role);
    const limit = clampNumber(parseInt(req.query.limit, 10) || 30, 1, 100);

    if (isDemoOrTestMode || !supabase) {
      const rows = service
        .listPostsDemo({ orgId: orgScope.orgId, includeHidden, search, topic })
        .slice(0, limit)
        .map((post) => service.mapPostEnvelope(post, { includeComments: false, viewerUserId: context.userId }));
      return sendOk(res, rows, { meta: { requestId: req.requestId ?? null } });
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    let query = supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .select('*')
      .eq('organization_id', orgScope.orgId)
      .is('deleted_at', null)
      .order('pinned_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeHidden) query = query.is('hidden_at', null);
    if (search) {
      const term = sanitizeIlike(search);
      query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }
    if (topic) {
      query = query.contains('topics', [topic.toLowerCase()]);
    }

    const { data, error } = await query;
    if (error) throw error;
    const posts = Array.isArray(data) ? data : [];
    const postIds = posts.map((row) => row.id).filter(Boolean);

    const reactionByPost = new Map();
    if (postIds.length) {
      const { data: reactionRows, error: reactionError } = await supabase
        .from(TEAM_HUDDLE_TABLES.reactions)
        .select('post_id,user_id,reaction_type')
        .in('post_id', postIds)
        .eq('organization_id', orgScope.orgId);
      if (reactionError) throw reactionError;
      (reactionRows || []).forEach((reaction) => {
        if (!reaction || !reaction.post_id) return;
        if (!reactionByPost.has(reaction.post_id)) {
          reactionByPost.set(reaction.post_id, { like: 0, dislike: 0, love: 0, viewerReaction: null });
        }
        const bucket = reactionByPost.get(reaction.post_id);
        if (TEAM_HUDDLE_REACTIONS.has(reaction.reaction_type)) {
          bucket[reaction.reaction_type] += 1;
        }
        if (reaction.user_id === context.userId) {
          bucket.viewerReaction = reaction.reaction_type;
        }
      });
    }

    const commentCountByPost = new Map();
    if (postIds.length) {
      const { data: commentRows, error: commentError } = await supabase
        .from(TEAM_HUDDLE_TABLES.comments)
        .select('post_id')
        .in('post_id', postIds)
        .eq('organization_id', orgScope.orgId)
        .is('deleted_at', null);
      if (commentError) throw commentError;
      (commentRows || []).forEach((comment) => {
        const count = commentCountByPost.get(comment.post_id) || 0;
        commentCountByPost.set(comment.post_id, count + 1);
      });
    }

    return sendOk(
      res,
      posts.map((post) => {
        const reactions = reactionByPost.get(post.id) || { like: 0, dislike: 0, love: 0, viewerReaction: null };
        return {
          ...post,
          reactionSummary: { like: reactions.like, dislike: reactions.dislike, love: reactions.love },
          viewerReaction: reactions.viewerReaction,
          commentCount: commentCountByPost.get(post.id) || 0,
        };
      }),
      { meta: { requestId: req.requestId ?? null } },
    );
  }));

  router.post('/team-huddle/posts', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    if (!service.enforceWriteLimit(req, res, context.userId)) return;

    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    const orgId = normalizeOrgIdValue(req.body?.organizationId ?? req.body?.organization_id ?? orgScope.orgId);
    if (!orgId) {
      return sendError(res, 400, 'org_required', 'Organization is required to create a post.');
    }
    const access = await requireOrgAccess(req, res, orgId, { write: true });
    if (!access) return;

    const title = service.sanitizeText(req.body?.title, 160);
    const body = service.sanitizeText(req.body?.body, 4000);
    if (!title || !body) {
      return sendError(res, 400, 'title_body_required', 'Post title and body are required.');
    }

    const payload = {
      id: randomUUID(),
      organization_id: orgId,
      user_id: context.userId,
      title,
      body,
      topics: service.normalizeTopics(req.body?.topics),
      locked_at: null,
      locked_by_user_id: null,
      pinned_at: null,
      pinned_by_user_id: null,
      hidden_at: null,
      hidden_by_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (isDemoOrTestMode || !supabase) {
      e2eStore.huddlePosts.set(payload.id, payload);
      persistE2EStore();
      return sendOk(res, service.mapPostEnvelope(payload, { viewerUserId: context.userId }), {
        status: 201,
        meta: { requestId: req.requestId ?? null },
      });
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data, error } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return sendOk(res, data, { status: 201, meta: { requestId: req.requestId ?? null } });
  }));

  router.get('/team-huddle/posts/:postId', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const { postId } = req.params;

    if (isDemoOrTestMode || !supabase) {
      const post = e2eStore.huddlePosts.get(postId);
      if (!post || post.deleted_at) {
        return sendError(res, 404, 'not_found', 'Post not found.');
      }
      const access = await requireOrgAccess(req, res, post.organization_id, { write: false });
      if (!access) return;
      if (post.hidden_at && !hasOrgAdminRole(access.role) && post.user_id !== context.userId) {
        return sendError(res, 404, 'not_found', 'Post not found.');
      }
      return sendOk(
        res,
        service.mapPostEnvelope(post, { includeComments: true, viewerUserId: context.userId }),
        { meta: { requestId: req.requestId ?? null } },
      );
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data: post, error } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .select('*')
      .eq('id', postId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!post) {
      return sendError(res, 404, 'not_found', 'Post not found.');
    }
    const access = await requireOrgAccess(req, res, post.organization_id, { write: false });
    if (!access) return;
    if (post.hidden_at && !hasOrgAdminRole(access.role) && post.user_id !== context.userId) {
      return sendError(res, 404, 'not_found', 'Post not found.');
    }

    const [{ data: comments, error: commentError }, { data: reactions, error: reactionError }] = await Promise.all([
      supabase
        .from(TEAM_HUDDLE_TABLES.comments)
        .select('*')
        .eq('post_id', postId)
        .eq('organization_id', post.organization_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from(TEAM_HUDDLE_TABLES.reactions)
        .select('user_id,reaction_type')
        .eq('post_id', postId)
        .eq('organization_id', post.organization_id),
    ]);
    if (commentError) throw commentError;
    if (reactionError) throw reactionError;

    const reactionSummary = { like: 0, dislike: 0, love: 0 };
    let viewerReaction = null;
    (reactions || []).forEach((reaction) => {
      if (TEAM_HUDDLE_REACTIONS.has(reaction.reaction_type)) reactionSummary[reaction.reaction_type] += 1;
      if (reaction.user_id === context.userId) viewerReaction = reaction.reaction_type;
    });

    return sendOk(
      res,
      {
        ...post,
        comments: comments || [],
        commentCount: (comments || []).length,
        reactionSummary,
        viewerReaction,
      },
      { meta: { requestId: req.requestId ?? null } },
    );
  }));

  router.post('/team-huddle/posts/:postId/comments', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    if (!service.enforceWriteLimit(req, res, context.userId)) return;
    const { postId } = req.params;
    const body = service.sanitizeText(req.body?.body, 2000);
    const parentCommentId = service.sanitizeText(req.body?.parentCommentId, 80) || null;
    if (!body) {
      return sendError(res, 400, 'comment_body_required', 'Comment body is required.');
    }

    if (isDemoOrTestMode || !supabase) {
      const post = e2eStore.huddlePosts.get(postId);
      if (!post || post.deleted_at) {
        return sendError(res, 404, 'not_found', 'Post not found.');
      }
      const access = await requireOrgAccess(req, res, post.organization_id, { write: true });
      if (!access) return;
      if (post.locked_at && !hasOrgAdminRole(access.role)) {
        return sendError(res, 423, 'post_locked', 'This post is locked for comments.');
      }
      const row = {
        id: randomUUID(),
        post_id: postId,
        organization_id: post.organization_id,
        parent_comment_id: parentCommentId,
        user_id: context.userId,
        body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      e2eStore.huddleComments.set(row.id, row);
      persistE2EStore();
      if (parentCommentId) {
        const parent = e2eStore.huddleComments.get(parentCommentId);
        if (parent?.user_id && parent.user_id !== context.userId && notificationService) {
          await notificationService.createNotification({
            title: 'New Team Huddle reply',
            body: `Someone replied to your comment in "${post.title}".`,
            userId: parent.user_id,
            organizationId: post.organization_id,
            type: 'team_huddle_reply',
            metadata: { postId: post.id, commentId: row.id },
          });
        }
      }
      return sendOk(res, row, { status: 201, meta: { requestId: req.requestId ?? null } });
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data: post, error: postError } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .select('id,title,organization_id,locked_at')
      .eq('id', postId)
      .is('deleted_at', null)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) {
      return sendError(res, 404, 'not_found', 'Post not found.');
    }
    const access = await requireOrgAccess(req, res, post.organization_id, { write: true });
    if (!access) return;
    if (post.locked_at && !hasOrgAdminRole(access.role)) {
      return sendError(res, 423, 'post_locked', 'This post is locked for comments.');
    }

    const payload = {
      id: randomUUID(),
      post_id: post.id,
      organization_id: post.organization_id,
      parent_comment_id: parentCommentId,
      user_id: context.userId,
      body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: inserted, error: insertError } = await supabase
      .from(TEAM_HUDDLE_TABLES.comments)
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (insertError) throw insertError;

    if (parentCommentId && notificationService) {
      const { data: parentComment } = await supabase
        .from(TEAM_HUDDLE_TABLES.comments)
        .select('user_id')
        .eq('id', parentCommentId)
        .eq('organization_id', post.organization_id)
        .maybeSingle();
      if (parentComment?.user_id && parentComment.user_id !== context.userId) {
        await notificationService.createNotification({
          title: 'New Team Huddle reply',
          body: `Someone replied to your comment in "${post.title}".`,
          userId: parentComment.user_id,
          organizationId: post.organization_id,
          type: 'team_huddle_reply',
          metadata: { postId: post.id, commentId: inserted?.id ?? null },
        });
      }
    }

    return sendOk(res, inserted, { status: 201, meta: { requestId: req.requestId ?? null } });
  }));

  router.post('/team-huddle/posts/:postId/reactions', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const reactionType = String(req.body?.reactionType || '').toLowerCase();
    if (!TEAM_HUDDLE_REACTIONS.has(reactionType)) {
      return sendError(res, 400, 'invalid_reaction', 'Reaction must be one of like, dislike, or love.');
    }
    const { postId } = req.params;

    if (isDemoOrTestMode || !supabase) {
      const post = e2eStore.huddlePosts.get(postId);
      if (!post || post.deleted_at) {
        return sendError(res, 404, 'not_found', 'Post not found.');
      }
      const access = await requireOrgAccess(req, res, post.organization_id, { write: false });
      if (!access) return;
      const key = `${postId}:${context.userId}`;
      const existing = e2eStore.huddleReactions.get(key);
      if (existing?.reaction_type === reactionType) {
        e2eStore.huddleReactions.delete(key);
      } else {
        e2eStore.huddleReactions.set(key, {
          id: randomUUID(),
          post_id: postId,
          organization_id: post.organization_id,
          user_id: context.userId,
          reaction_type: reactionType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      persistE2EStore();
      const next = service.mapPostEnvelope(post, { viewerUserId: context.userId });
      return sendOk(
        res,
        { reactionSummary: next.reactionSummary, viewerReaction: next.viewerReaction },
        { meta: { requestId: req.requestId ?? null } },
      );
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data: post, error: postError } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .select('id,organization_id')
      .eq('id', postId)
      .is('deleted_at', null)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) {
      return sendError(res, 404, 'not_found', 'Post not found.');
    }
    const access = await requireOrgAccess(req, res, post.organization_id, { write: false });
    if (!access) return;

    const { data: existing, error: existingError } = await supabase
      .from(TEAM_HUDDLE_TABLES.reactions)
      .select('id,reaction_type')
      .eq('post_id', postId)
      .eq('organization_id', post.organization_id)
      .eq('user_id', context.userId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.reaction_type === reactionType) {
      const { error: deleteError } = await supabase.from(TEAM_HUDDLE_TABLES.reactions).delete().eq('id', existing.id);
      if (deleteError) throw deleteError;
    } else {
      const upsertPayload = {
        id: existing?.id ?? randomUUID(),
        post_id: postId,
        organization_id: post.organization_id,
        user_id: context.userId,
        reaction_type: reactionType,
        updated_at: new Date().toISOString(),
      };
      const { error: upsertError } = await supabase
        .from(TEAM_HUDDLE_TABLES.reactions)
        .upsert(upsertPayload, { onConflict: 'post_id,user_id' });
      if (upsertError) throw upsertError;
    }

    const { data: reactions, error: reactionError } = await supabase
      .from(TEAM_HUDDLE_TABLES.reactions)
      .select('user_id,reaction_type')
      .eq('post_id', postId)
      .eq('organization_id', post.organization_id);
    if (reactionError) throw reactionError;
    const summary = { like: 0, dislike: 0, love: 0 };
    let viewerReaction = null;
    (reactions || []).forEach((row) => {
      if (TEAM_HUDDLE_REACTIONS.has(row.reaction_type)) summary[row.reaction_type] += 1;
      if (row.user_id === context.userId) viewerReaction = row.reaction_type;
    });

    return sendOk(res, { reactionSummary: summary, viewerReaction }, { meta: { requestId: req.requestId ?? null } });
  }));

  router.post('/team-huddle/posts/:postId/report', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    if (!service.enforceWriteLimit(req, res, context.userId)) return;
    const reason = service.sanitizeText(req.body?.reason, 1200);
    if (!reason) {
      return sendError(res, 400, 'report_reason_required', 'Please include a reason for reporting this post.');
    }
    const { postId } = req.params;

    if (isDemoOrTestMode || !supabase) {
      const post = e2eStore.huddlePosts.get(postId);
      if (!post || post.deleted_at) {
        return sendError(res, 404, 'not_found', 'Post not found.');
      }
      const access = await requireOrgAccess(req, res, post.organization_id, { write: false });
      if (!access) return;
      const row = {
        id: randomUUID(),
        post_id: postId,
        organization_id: post.organization_id,
        comment_id: null,
        reporter_user_id: context.userId,
        reason,
        status: 'open',
        resolved_at: null,
        resolved_by_user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      e2eStore.huddleReports.set(row.id, row);
      persistE2EStore();
      return sendOk(res, row, { status: 201, meta: { requestId: req.requestId ?? null } });
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data: post, error: postError } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .select('id,organization_id')
      .eq('id', postId)
      .is('deleted_at', null)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) {
      return sendError(res, 404, 'not_found', 'Post not found.');
    }
    const access = await requireOrgAccess(req, res, post.organization_id, { write: false });
    if (!access) return;

    const payload = {
      id: randomUUID(),
      post_id: postId,
      organization_id: post.organization_id,
      comment_id: null,
      reporter_user_id: context.userId,
      reason,
      status: 'open',
      resolved_at: null,
      resolved_by_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(TEAM_HUDDLE_TABLES.reports)
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return sendOk(res, data, { status: 201, meta: { requestId: req.requestId ?? null } });
  }));

  router.get('/admin/team-huddle/reports', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const orgScope = resolveOrgScopeFromRequest(req, context, { requireExplicitSelection: true });
    if (!orgScope.orgId) {
      return sendError(res, 400, 'org_required', 'Organization is required.');
    }
    const access = await requireOrgAccess(req, res, orgScope.orgId, { write: false, requireOrgAdmin: true });
    if (!access) return;

    if (isDemoOrTestMode || !supabase) {
      const reports = Array.from(e2eStore.huddleReports.values())
        .filter((report) => report.organization_id === orgScope.orgId)
        .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
        .map((report) => ({
          ...report,
          post: e2eStore.huddlePosts.get(report.post_id) ?? null,
        }));
      return sendOk(res, reports, { meta: { requestId: req.requestId ?? null } });
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data, error } = await supabase
      .from(TEAM_HUDDLE_TABLES.reports)
      .select('*, post:team_huddle_posts(*)')
      .eq('organization_id', orgScope.orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return sendOk(res, data || [], { meta: { requestId: req.requestId ?? null } });
  }));

  router.post('/admin/team-huddle/posts/:postId/moderate', asyncHandler(async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!action) {
      return sendError(res, 400, 'action_required', 'Moderation action is required.');
    }
    const { postId } = req.params;
    const validActions = new Set(['hide', 'unhide', 'lock', 'unlock', 'pin', 'unpin', 'remove']);
    if (!validActions.has(action)) {
      return sendError(res, 400, 'invalid_action', 'Unsupported moderation action.');
    }

    if (isDemoOrTestMode || !supabase) {
      const post = e2eStore.huddlePosts.get(postId);
      if (!post || post.deleted_at) {
        return sendError(res, 404, 'not_found', 'Post not found.');
      }
      const access = await requireOrgAccess(req, res, post.organization_id, { write: true, requireOrgAdmin: true });
      if (!access) return;
      const next = service.applyModerationMutation(post, action, context.userId);
      e2eStore.huddlePosts.set(postId, next);
      for (const report of e2eStore.huddleReports.values()) {
        if (report.post_id === postId && report.status === 'open') {
          report.status = 'resolved';
          report.resolved_at = new Date().toISOString();
          report.resolved_by_user_id = context.userId;
        }
      }
      persistE2EStore();
      return sendOk(
        res,
        service.mapPostEnvelope(next, { viewerUserId: context.userId }),
        { meta: { requestId: req.requestId ?? null } },
      );
    }

    const readiness = await ensureReadiness();
    if (!readiness.ok) {
      respondSchemaUnavailable(res, 'team_huddle', readiness);
      return;
    }

    const { data: post, error: postError } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .select('*')
      .eq('id', postId)
      .is('deleted_at', null)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) {
      return sendError(res, 404, 'not_found', 'Post not found.');
    }
    const access = await requireOrgAccess(req, res, post.organization_id, { write: true, requireOrgAdmin: true });
    if (!access) return;

    const patch = service.applyModerationMutation(post, action, context.userId);
    const { data: updated, error: updateError } = await supabase
      .from(TEAM_HUDDLE_TABLES.posts)
      .update(patch)
      .eq('id', postId)
      .select('*')
      .maybeSingle();
    if (updateError) throw updateError;

    const { error: reportUpdateError } = await supabase
      .from(TEAM_HUDDLE_TABLES.reports)
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by_user_id: context.userId })
      .eq('post_id', postId)
      .eq('organization_id', post.organization_id)
      .eq('status', 'open');
    if (reportUpdateError) throw reportUpdateError;

    if (action === 'pin' && notificationService) {
      await notificationService.createNotification({
        title: 'Team Huddle post pinned',
        body: `A moderator pinned "${updated?.title || post.title}" in Team Huddle.`,
        organizationId: post.organization_id,
        type: 'team_huddle_pin',
        metadata: { postId },
      });
    }

    return sendOk(res, updated, { meta: { requestId: req.requestId ?? null } });
  }));

  return router;
};

export default createTeamHuddleRouter;
