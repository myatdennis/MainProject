import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { useToast } from '../../context/ToastContext';
import {
  addTeamHuddleComment,
  getTeamHuddlePost,
  reactToTeamHuddlePost,
  reportTeamHuddlePost,
  type TeamHuddleComment,
  type TeamHuddlePost,
  type TeamHuddleReactionType,
} from '../../dal/teamHuddle';
import { trackEvent } from '../../dal/analytics';

const FollowedThreadsKey = 'huddle:team-huddle-followed-threads';
const SeenCommentsKey = 'huddle:team-huddle-seen-comments';

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const loadLocalStored = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  return safeJsonParse(window.localStorage.getItem(key), fallback);
};

const saveLocalStored = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota failures
  }
};

const extractUrls = (text: string) => Array.from(new Set(Array.from(text.match(/https?:\/\/[\w\-./?=&%#]+/gi) || [])));
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
const getFirstImageUrl = (text: string) => extractUrls(text).find(isImageUrl);

interface TeamHuddlePostPageProps {
  basePath: '/client' | '/lms';
}

interface ThreadedComment extends TeamHuddleComment {
  replies: ThreadedComment[];
}

const TeamHuddlePostPage = ({ basePath }: TeamHuddlePostPageProps) => {
  const { user } = useSecureAuth();
  const { showToast } = useToast();
  const { postId = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<TeamHuddlePost | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [newReplyCount, setNewReplyCount] = useState(0);

  const reactionLabels: TeamHuddleReactionType[] = ['like', 'love', 'dislike'];

  const quickReplyPrompts = [
    'What did you learn from this?',
    'Here’s one practical next step...',
    'I appreciate this because...',
  ];

  const updateThreadState = useCallback(
    (postItem: TeamHuddlePost) => {
      const storedSeen = loadLocalStored<Record<string, number>>(SeenCommentsKey, {});
      const previousSeen = storedSeen[postItem.id] ?? 0;
      const currentCount = postItem.comments?.length ?? 0;
      setNewReplyCount(Math.max(0, currentCount - previousSeen));
      setFollowed(loadLocalStored<string[]>(FollowedThreadsKey, []).includes(postItem.id));
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getTeamHuddlePost(postId);
      setPost(row);
      updateThreadState(row);
    } catch (err) {
      console.error('Failed to load Team Huddle post', err);
      setError('Unable to load this post right now.');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId, updateThreadState]);

  useEffect(() => {
    void refresh();
  }, [postId, refresh]);

  const markThreadRead = useCallback(() => {
    if (!post) return;
    const storedSeen = loadLocalStored<Record<string, number>>(SeenCommentsKey, {});
    const nextSeen = { ...storedSeen, [post.id]: post.comments?.length ?? 0 };
    saveLocalStored(SeenCommentsKey, nextSeen);
    setNewReplyCount(0);
    showToast('This thread is marked as read.', 'success');
    trackEvent('navigation_click', user?.id ?? 'anonymous', {
      category: 'team_huddle',
      action: 'thread_marked_read',
      postId: post.id,
    });
  }, [post, showToast]);

  const handleFollowToggle = async () => {
    if (!postId) return;
    const nextState = !followed;
    setFollowed(nextState);
    showToast(nextState ? 'Following thread' : 'Unfollowed thread', 'success');
    const currentFollowed = loadLocalStored<string[]>(FollowedThreadsKey, []);
    if (nextState) {
      saveLocalStored(FollowedThreadsKey, [...currentFollowed, postId]);
    } else {
      saveLocalStored(FollowedThreadsKey, currentFollowed.filter((id) => id !== postId));
    }
    trackEvent('navigation_click', user?.id ?? 'anonymous', {
      category: 'team_huddle',
      action: nextState ? 'thread_followed' : 'thread_unfollowed',
      postId,
    });
  };

  const threadedComments = useMemo(() => {
    const commentMap = new Map<string, ThreadedComment>();
    const roots: ThreadedComment[] = [];
    (post?.comments || []).forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    (post?.comments || []).forEach((comment) => {
      if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
        commentMap.get(comment.parent_comment_id)!.replies.push(commentMap.get(comment.id)!);
      } else {
        roots.push(commentMap.get(comment.id)!);
      }
    });
    const sortComments = (commentsList: ThreadedComment[]) => {
      commentsList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      commentsList.forEach((comment) => sortComments(comment.replies));
    };
    sortComments(roots);
    return roots;
  }, [post?.comments]);

  const handleAddComment = async (parentId?: string | null) => {
    if (!postId || !(parentId ? replyBody.trim() : commentBody.trim())) return;
    try {
      await addTeamHuddleComment(postId, {
        body: parentId ? replyBody : commentBody,
        parentCommentId: parentId ?? null,
      });
      setCommentBody('');
      setReplyBody('');
      setReplyToCommentId(null);
      await refresh();
      trackEvent('navigation_click', user?.id ?? 'anonymous', {
        category: 'team_huddle',
        action: parentId ? 'comment_replied' : 'comment_created',
        postId,
        parentCommentId: parentId ?? undefined,
      });
    } catch (err) {
      console.error('Failed to add Team Huddle comment', err);
      setError('Unable to add your comment. Please try again.');
    }
  };

  const handleReplyClick = (commentId: string) => {
    setReplyToCommentId((current) => (current === commentId ? null : commentId));
    setReplyBody('');
  };

  const handleReport = async () => {
    if (!postId || !reportReason.trim()) return;
    try {
      await reportTeamHuddlePost(postId, reportReason);
      setReportReason('');
      setError('Thank you. Your report was submitted to the team moderator.');
    } catch (err) {
      console.error('Failed to report Team Huddle post', err);
      setError('Unable to submit your report. Please try again.');
    }
  };

  const handleReact = async (reactionType: TeamHuddleReactionType) => {
    if (!postId) return;
    try {
      const next = await reactToTeamHuddlePost(postId, reactionType);
      setPost((current) =>
        current
          ? {
              ...current,
              reactionSummary: next.reactionSummary,
              viewerReaction: next.viewerReaction,
            }
          : current,
      );
      trackEvent('navigation_click', user?.id ?? 'anonymous', {
        category: 'team_huddle',
        action: 'post_reaction',
        reactionType,
        postId,
      });
    } catch (err) {
      console.error('Failed to react to Team Huddle post', err);
      setError('Unable to submit your reaction. Please try again.');
    }
  };

  const renderCommentBranch = (comment: ThreadedComment, depth = 0) => {
    return (
      <div key={comment.id} className="space-y-3">
        <div
          className="rounded-3xl border border-mist/80 bg-cloud/40 p-4"
          style={{ marginLeft: depth * 18 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Team member</p>
              <p className="text-xs text-slate-500">{new Date(comment.created_at).toLocaleString()}</p>
            </div>
            <button
              type="button"
              onClick={() => handleReplyClick(comment.id)}
              className="text-xs font-semibold text-skyblue hover:text-skyblue/80"
            >
              Reply
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate/80">{comment.body}</p>
          {comment.replies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'}</span>
              <span>•</span>
              <span>Threaded conversation</span>
            </div>
          )}
        </div>
        {replyToCommentId === comment.id && (
          <div className="rounded-3xl border border-slate-200 bg-white p-4" style={{ marginLeft: depth * 18 + 18 }}>
            <Input
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder="Write a reply..."
            />
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={() => void handleAddComment(comment.id)} disabled={!replyBody.trim()}>
                Post reply
              </Button>
              <Button variant="ghost" onClick={() => setReplyToCommentId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {comment.replies.map((reply) => renderCommentBranch(reply, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <Card>Loading post…</Card>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <Card className="space-y-3 border border-red-200 text-red-700">
          <p>{error || 'Post not found.'}</p>
          <Button variant="ghost" asChild>
            <Link to={`${basePath}/team-huddle`}>Back to Team Huddle</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`${basePath}/team-huddle`}>← Back to Team Huddle</Link>
            </Button>
            <h1 className="font-heading text-3xl font-bold text-charcoal mt-3">{post.title}</h1>
            <p className="text-sm text-slate/60">
              Posted {new Date(post.created_at).toLocaleString()} • {post.user_id === user?.id ? 'You' : 'Team member'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(post.topics || []).map((topic) => (
              <Badge key={`topic-${topic}`} tone="info">#{topic}</Badge>
            ))}
            <Button size="sm" variant={followed ? 'primary' : 'ghost'} onClick={handleFollowToggle}>
              {followed ? 'Following' : 'Follow thread'}
            </Button>
            {newReplyCount > 0 ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                <span>{newReplyCount} new reply{newReplyCount === 1 ? '' : 'ies'}</span>
                <button type="button" onClick={markThreadRead} className="text-amber-900 underline">
                  Mark as read
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {getFirstImageUrl(post.body) && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
            <img
              src={getFirstImageUrl(post.body) ?? ''}
              alt="Shared preview"
              className="h-72 w-full object-cover"
            />
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm text-slate/80">{post.body}</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-charcoal">Add your perspective</h2>
            <p className="text-sm text-slate-500">Use this space to build momentum and keep the conversation moving.</p>
          </div>
          <div className="flex items-center flex-wrap gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3">
            {reactionLabels.map((reaction) => {
              const active = post?.viewerReaction === reaction;
              const count = post?.reactionSummary?.[reaction] ?? 0;
              return (
                <Button
                  key={reaction}
                  size="sm"
                  variant={active ? 'primary' : 'ghost'}
                  onClick={() => void handleReact(reaction)}
                >
                  {reaction} ({count})
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {quickReplyPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setCommentBody(prompt)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-skyblue hover:text-skyblue"
            >
              {prompt}
            </button>
          ))}
        </div>
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          placeholder="Share a thoughtful reply, question, or practical suggestion..."
          className="min-h-[120px] w-full rounded-3xl border border-mist bg-white px-4 py-4 text-sm text-charcoal shadow-inner focus:border-skyblue/40 focus:outline-none"
        />
        <p className="text-xs text-slate-500">Use this space to build momentum and keep the conversation moving.</p>
        <Button onClick={() => void handleAddComment()} disabled={!commentBody.trim()}>
          Add comment
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-charcoal">Discussion thread</h2>
            <p className="text-sm text-slate-500">Keep the conversation productive with structured replies.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {post.comments?.length ?? 0} comments
          </span>
        </div>
        {threadedComments.length === 0 ? (
          <p className="text-sm text-slate-700">No comments yet. Start the discussion with a thoughtful reply.</p>
        ) : (
          <div className="space-y-4">
            {threadedComments.map((comment) => renderCommentBranch(comment))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Report this post</h2>
        <Input
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          placeholder="Reason for report (harassment, spam, inappropriate content)"
        />
        <Button variant="ghost" onClick={() => void handleReport()} disabled={!reportReason.trim()}>
          Submit report
        </Button>
      </Card>

      {error && <Card className="border border-red-200 text-red-700">{error}</Card>}
    </div>
  );
};

export default TeamHuddlePostPage;
