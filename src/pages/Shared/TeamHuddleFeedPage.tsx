import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Bookmark,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/Modal';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { useToast } from '../../context/ToastContext';
import { trackEvent } from '../../dal/analytics';
import {
  createTeamHuddlePost,
  listTeamHuddlePosts,
  reactToTeamHuddlePost,
  type TeamHuddlePost,
  type TeamHuddleReactionType,
} from '../../dal/teamHuddle';

interface TeamHuddleFeedPageProps {
  basePath: '/client' | '/lms';
  heading: string;
}

const SMART_PROMPTS = [
  {
    label: 'Share a win',
    title: 'Team win spotlight',
    body: 'Today the team moved a project forward by...',
    topics: ['celebration', 'momentum'],
  },
  {
    label: 'Ask a question',
    title: 'Question for the team',
    body: 'I’d love input on how we can improve...',
    topics: ['feedback', 'collaboration'],
  },
  {
    label: 'Post a resource',
    title: 'Resource share',
    body: 'This guide helped me understand...',
    topics: ['resource', 'learning'],
  },
  {
    label: 'Start a reflection',
    title: 'Reflection prompt',
    body: 'One leadership lesson I learned this week is...',
    topics: ['reflection', 'growth'],
  },
];

const DEFAULT_TOPICS = ['leadership', 'inclusion', 'teamwork', 'culture', 'feedback', 'wellbeing'];
const HuddleDraftKey = 'huddle:team-huddle-draft-v1';
const FollowedThreadsKey = 'huddle:team-huddle-followed-threads';
const SeenCommentsKey = 'huddle:team-huddle-seen-comments';
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 2400;

const reactionLabels: TeamHuddleReactionType[] = ['like', 'love', 'dislike'];

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

const listUrls = (text: string) => Array.from(new Set(Array.from(text.match(/https?:\/\/[\w\-./?=&%#]+/gi) || [])));
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
const isResourceUrl = (url: string) => /\.(pdf|docx?|pptx?|xlsx?|csv|txt)$/i.test(url);
const normalizeTopic = (topic: string) => topic.trim().toLowerCase();

const extractEmbedUrl = (url: string) => {
  const normalized = url.trim();
  if (/youtube\.com\/watch\?v=([\w-]+)/i.test(normalized)) {
    const match = normalized.match(/v=([\w-]+)/i);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }
  if (/youtu\.be\/([\w-]+)/i.test(normalized)) {
    const match = normalized.match(/youtu\.be\/([\w-]+)/i);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }
  if (/vimeo\.com\/(\d+)/i.test(normalized)) {
    const match = normalized.match(/vimeo\.com\/(\d+)/i);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(normalized)) {
    return normalized;
  }
  return null;
};

const getLinkLabel = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getLinkSummary = (url: string) => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/$/, '');
    return pathname || parsed.hostname;
  } catch {
    return url;
  }
};

const TeamHuddleFeedPage = ({ basePath, heading }: TeamHuddleFeedPageProps) => {
  const { user } = useSecureAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<TeamHuddlePost[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topics, setTopics] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [followedPostIds, setFollowedPostIds] = useState<string[]>([]);
  const [seenCommentCounts, setSeenCommentCounts] = useState<Record<string, number>>({});
  const [expandedPostIds, setExpandedPostIds] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const pollRef = useRef<number | null>(null);

  const selectedTopics = useMemo(() => {
    return Array.from(
      new Set(
        topics
          .split(',')
          .map(normalizeTopic)
          .filter(Boolean),
      ),
    );
  }, [topics]);

  const trendingTopicCounts = useMemo(() => {
    return posts.reduce<Record<string, number>>((acc, post) => {
      (post.topics || []).forEach((topic) => {
        if (!topic) return;
        acc[topic] = (acc[topic] || 0) + 1 + (post.commentCount ?? 0) * 0.3;
      });
      return acc;
    }, {});
  }, [posts]);

  const topTopics = useMemo(() => {
    return Object.entries(trendingTopicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topic]) => topic);
  }, [trendingTopicCounts]);

  const activeDiscussions = useMemo(() => {
    return [...posts]
      .filter((post) => (post.commentCount ?? 0) > 0)
      .sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0))
      .slice(0, 4);
  }, [posts]);

  const sharedResources = useMemo(() => {
    return posts
      .flatMap((post) =>
        listUrls(post.body)
          .filter(isResourceUrl)
          .slice(0, 1)
          .map((url) => ({ url, title: getLinkLabel(url), postTitle: post.title, postId: post.id })),
      )
      .slice(0, 4);
  }, [posts]);

  const yourRecentPosts = useMemo(() => {
    return user
      ? posts.filter((post) => post.user_id === user.id).slice(0, 4)
      : [];
  }, [posts, user]);

  const followedThreads = useMemo(() => {
    return posts.filter((post) => followedPostIds.includes(post.id));
  }, [posts, followedPostIds]);

  const newReplyCounts = useMemo(() => {
    return posts.reduce<Record<string, number>>((acc, post) => {
      const seen = seenCommentCounts[post.id] ?? 0;
      if ((post.commentCount ?? 0) > seen) acc[post.id] = (post.commentCount ?? 0) - seen;
      return acc;
    }, {});
  }, [posts, seenCommentCounts]);

  const teamStats = useMemo(() => {
    const conversationCount = posts.length;
    const commentCount = posts.reduce((sum, post) => sum + (post.commentCount ?? 0), 0);
    const topicCount = Object.keys(trendingTopicCounts).length;
    return { conversationCount, commentCount, topicCount };
  }, [posts, trendingTopicCounts]);

  const loadSavedState = useCallback(() => {
    const storedDraft = loadLocalStored<{ title: string; body: string; topics: string }>(HuddleDraftKey, {
      title: '',
      body: '',
      topics: '',
    });
    setTitle(storedDraft.title);
    setBody(storedDraft.body);
    setTopics(storedDraft.topics);
    setFollowedPostIds(loadLocalStored<string[]>(FollowedThreadsKey, []));
    setSeenCommentCounts(loadLocalStored<Record<string, number>>(SeenCommentsKey, {}));
  }, []);

  const persistDraft = useCallback(() => {
    saveLocalStored(HuddleDraftKey, { title, body, topics });
    setRequestMessage('Draft saved locally. You can continue anytime.');
  }, [title, body, topics]);

  const refresh = useCallback(
    async (nextSearch = search, nextTopic = activeTopic) => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listTeamHuddlePosts({ search: nextSearch, topic: nextTopic ?? undefined });
        setPosts(rows);
        setNewPostsAvailable(false);
      } catch (err) {
        console.error('Failed to load Team Huddle posts', err);
        setError('Unable to load Team Huddle right now.');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    },
    [activeTopic, search],
  );

  useEffect(() => {
    loadSavedState();
    void refresh();
  }, [loadSavedState, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (title || body || topics) persistDraft();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [title, body, topics, persistDraft]);

  useEffect(() => {
    const poll = async () => {
      try {
        const rows = await listTeamHuddlePosts({ search: '', topic: activeTopic ?? undefined });
        if (rows.length > posts.length || rows[0]?.id !== posts[0]?.id) {
          setNewPostsAvailable(true);
        }
      } catch {
        // ignore poll failures
      }
    };
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(poll, 60000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeTopic, posts]);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      setError('Write a brief title and helpful note before posting.');
      return;
    }
    if (body.length > MAX_BODY_LENGTH) {
      setError(`Keep your message under ${MAX_BODY_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTeamHuddlePost({
        title: title.trim(),
        body: body.trim(),
        topics: selectedTopics,
      });
      setTitle('');
      setBody('');
      setTopics('');
      saveLocalStored(HuddleDraftKey, { title: '', body: '', topics: '' });
      showToast('Your update is live in Team Huddle.', 'success');
      trackEvent('navigation_click', user?.id ?? 'anonymous', {
        category: 'team_huddle',
        action: 'post_created',
      });
      await refresh();
    } catch (err) {
      console.error('Failed to create Team Huddle post', err);
      showToast('Unable to publish your post. Please try again.', 'error');
      setError('Unable to publish your post. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [title, body, selectedTopics, refresh, showToast, user?.id]);

  const handleReact = useCallback(
    async (postId: string, reactionType: TeamHuddleReactionType) => {
      const previousPosts = posts;
      const nextPosts = posts.map((post) => {
        if (post.id !== postId) return post;
        const currentCount = post.reactionSummary?.[reactionType] ?? 0;
        const isActive = post.viewerReaction === reactionType;
        const delta = isActive ? -1 : 1;
        return {
          ...post,
          viewerReaction: isActive ? null : reactionType,
          reactionSummary: {
            ...post.reactionSummary,
            [reactionType]: currentCount + delta,
          },
        } as TeamHuddlePost;
      });
      setPosts(nextPosts);
      try {
        const next = await reactToTeamHuddlePost(postId, reactionType);
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? { ...post, reactionSummary: next.reactionSummary, viewerReaction: next.viewerReaction }
              : post,
          ),
        );
        trackEvent('navigation_click', user?.id ?? 'anonymous', {
          category: 'team_huddle',
          action: 'reaction_added',
          reactionType,
        });
      } catch (err) {
        console.error('Failed to react to Team Huddle post', err);
        setPosts(previousPosts);
        showToast('Could not update your reaction. Please try again.', 'error');
      }
    },
    [posts, showToast, user?.id],
  );

  const handlePromptFill = useCallback(
    (promptIndex: number) => {
      const prompt = SMART_PROMPTS[promptIndex];
      setTitle(prompt.title);
      setBody(prompt.body);
      setTopics(prompt.topics.join(', '));
      trackEvent('navigation_click', user?.id ?? 'anonymous', {
        category: 'team_huddle',
        action: 'prompt_chip_used',
        prompt: prompt.label,
      });
    },
    [user?.id],
  );

  const handleTopicFilter = useCallback(
    (topic: string) => {
      setActiveTopic(topic);
      setSearch('');
      void refresh('', topic);
      trackEvent('navigation_click', user?.id ?? 'anonymous', {
        category: 'team_huddle',
        action: 'topic_clicked',
        topic,
      });
    },
    [refresh, user?.id],
  );

  const toggleFollow = useCallback(
    (postId: string) => {
      const next = followedPostIds.includes(postId)
        ? followedPostIds.filter((id) => id !== postId)
        : [...followedPostIds, postId];
      setFollowedPostIds(next);
      saveLocalStored(FollowedThreadsKey, next);
      trackEvent('navigation_click', user?.id ?? 'anonymous', {
        category: 'team_huddle',
        action: followedPostIds.includes(postId) ? 'thread_unfollowed' : 'thread_followed',
        postId,
      });
    },
    [followedPostIds, user?.id],
  );

  const toggleExpanded = useCallback((postId: string) => {
    setExpandedPostIds((current) =>
      current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId],
    );
  }, []);

  const renderRichBody = useCallback((text: string) => {
    if (!text) return text;
    const parts = text.split(/(https?:\/\/[\w\-./?=&%#]+)/gi);
    return parts.map((part, index) => {
      if (/^https?:\/\//i.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-skyblue hover:text-skyblue/90"
            onClick={() =>
              trackEvent('navigation_click', user?.id ?? 'anonymous', {
                category: 'team_huddle',
                action: 'link_opened',
                url: part,
              })
            }
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, [user?.id]);

  const connected = useMemo(
    () => ({
      conversations: teamStats.conversationCount,
      replies: teamStats.commentCount,
      topics: teamStats.topicCount,
    }),
    [teamStats],
  );

  const renderPostMedia = useCallback(
    (post: TeamHuddlePost) => {
      const urls = listUrls(post.body);
      const imageUrl = urls.find(isImageUrl);
      const embedUrl = urls.map(extractEmbedUrl).find(Boolean) as string | null;
      if (embedUrl) {
        return (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
            <div className="relative h-60 w-full">
              <iframe
                title={`Embedded media for ${post.title}`}
                src={embedUrl}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        );
      }
      if (imageUrl) {
        return (
          <button
            type="button"
            onClick={() => {
              setPreviewImage(imageUrl);
              setShowPreviewModal(true);
              trackEvent('navigation_click', user?.id ?? 'anonymous', {
                category: 'team_huddle',
                action: 'media_opened',
                url: imageUrl,
              });
            }}
            className="group overflow-hidden rounded-3xl border border-slate-200 bg-slate-100"
          >
            <img
              src={imageUrl}
              alt="Shared preview"
              className="h-56 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
            />
          </button>
        );
      }
      return null;
    },
    [user?.id],
  );

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => {
      const aScore = a.pinned_at ? 1000 : 0 + (a.commentCount ?? 0) * 5;
      const bScore = b.pinned_at ? 1000 : 0 + (b.commentCount ?? 0) * 5;
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
    [posts],
  );

  const buildEmptyState = () => (
    <Card className="space-y-6 border border-slate-200 bg-slate-50 px-6 py-8 text-center" tone="muted">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Team Huddle</p>
        <h2 className="mt-3 text-2xl font-semibold text-charcoal">There’s no conversation yet.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Kick off the conversation with a quick team update, question, or shared resource. We’ll help you keep momentum going.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SMART_PROMPTS.map((prompt, index) => (
          <Button
            key={prompt.label}
            variant="secondary"
            size="lg"
            className="justify-between rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:border-skyblue"
            onClick={() => handlePromptFill(index)}
          >
            <span>{prompt.label}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Quick start</p>
        <p className="mt-2 text-slate-600">Try one of the starter posts in the composer, then come back to see your post here.</p>
      </div>
    </Card>
  );

  const renderSkeletons = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="animate-pulse rounded-3xl border border-slate-200 bg-slate-100 p-6">
          <div className="h-5 w-3/5 rounded-full bg-slate-200" />
          <div className="mt-4 h-4 w-2/3 rounded-full bg-slate-200" />
          <div className="mt-3 h-24 rounded-2xl bg-slate-200" />
          <div className="mt-4 flex gap-3">
            <div className="h-10 w-24 rounded-full bg-slate-200" />
            <div className="h-10 w-24 rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card tone="gradient" withBorder={false} className="space-y-4 overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">Team Huddle</p>
                <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-white">{heading}</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-100">Where teams connect, share, and grow together.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-white">
                <div className="rounded-3xl bg-white/10 px-4 py-4 text-center">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-200">Conversations</p>
                  <p className="mt-2 text-2xl font-semibold">{connected.conversations}</p>
                </div>
                <div className="rounded-3xl bg-white/10 px-4 py-4 text-center">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-200">Responses</p>
                  <p className="mt-2 text-2xl font-semibold">{connected.replies}</p>
                </div>
                <div className="rounded-3xl bg-white/10 px-4 py-4 text-center">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-200">Topics</p>
                  <p className="mt-2 text-2xl font-semibold">{connected.topics}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
              <Sparkles className="h-4 w-4" />
              <span>Share quick wins, surface helpful resources, and keep the team aligned every time you stop by.</span>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-charcoal">Start a conversation</p>
                <p className="text-sm text-slate-600">Choose a prompt, add a topic, or drop in a resource link.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SMART_PROMPTS.slice(0, 2).map((prompt, index) => (
                  <Button
                    key={prompt.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePromptFill(index)}
                  >
                    {prompt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label htmlFor="team-huddle-title" className="block text-sm font-medium text-slate-700">
                Headline
              </label>
              <Input
                id="team-huddle-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What’s happening in your team?"
                aria-describedby="team-huddle-title-help"
                maxLength={MAX_TITLE_LENGTH}
              />
              <p id="team-huddle-title-help" className="mt-2 text-xs text-slate-500">
                A clear title helps your feed stay discoverable. {title.length}/{MAX_TITLE_LENGTH}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label htmlFor="team-huddle-body" className="block text-sm font-medium text-slate-700">
                Tell the team more
              </label>
              <textarea
                id="team-huddle-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Add context, links, or a quick question to make this post actionable."
                className="min-h-[140px] w-full resize-y rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 shadow-sm focus:border-skyblue/50 focus:outline-none focus:ring-2 focus:ring-skyblue/10"
                aria-describedby="team-huddle-body-help"
              />
              <p id="team-huddle-body-help" className="mt-2 text-xs text-slate-500">
                {body.length > MAX_BODY_LENGTH
                  ? `Please shorten your message to ${MAX_BODY_LENGTH} characters.`
                  : `${MAX_BODY_LENGTH - body.length} characters remaining.`}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="team-huddle-topics" className="block text-sm font-medium text-slate-700">
                  Topics
                </label>
                <Input
                  id="team-huddle-topics"
                  value={topics}
                  onChange={(event) => setTopics(event.target.value)}
                  placeholder="Add 1–3 keywords, separated by commas"
                  aria-describedby="team-huddle-topics-help"
                />
                <p id="team-huddle-topics-help" className="mt-2 text-xs text-slate-500">
                  Suggested topics are based on your feed and help teammates discover your post.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...new Set([...selectedTopics, ...topTopics, ...DEFAULT_TOPICS])]
                    .slice(0, 8)
                    .map((topic) => (
                      <button
                        key={`composer-topic-${topic}`}
                        type="button"
                        onClick={() => {
                          const next = Array.from(new Set([...selectedTopics, topic]));
                          setTopics(next.join(', '));
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-skyblue hover:text-skyblue"
                      >
                        #{topic}
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !title.trim() || !body.trim() || body.length > MAX_BODY_LENGTH}
                  className="w-full rounded-3xl"
                >
                  {saving ? 'Publishing…' : 'Share with the team'}
                </Button>
              </div>
            </div>
            {requestMessage && <p className="text-sm text-slate-500">{requestMessage}</p>}
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-slate-700">
                <Search className="h-4 w-4" />
                <span className="text-sm">Search and discover the most relevant discussions.</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search posts, questions, or topics"
                  className="min-w-[180px]"
                  aria-label="Search Team Huddle posts"
                />
                <Button variant="ghost" onClick={() => void refresh(search)}>
                  Search
                </Button>
              </div>
            </div>
            {activeTopic ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Filtered by:</span>
                <Badge tone="info">#{activeTopic}</Badge>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTopic(null);
                    void refresh(search, null);
                  }}
                  className="text-xs font-semibold text-skyblue hover:text-skyblue/80"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Trending topics:</span>
                {topTopics.length ? (
                  topTopics.map((topic) => (
                    <button
                      key={`topic-${topic}`}
                      type="button"
                      onClick={() => handleTopicFilter(topic)}
                      className="rounded-full bg-skyblue/10 px-3 py-1 text-xs font-semibold text-skyblue transition hover:bg-skyblue/20"
                    >
                      #{topic}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No trending topics yet.</span>
                )}
              </div>
            )}
          </Card>

          {newPostsAvailable && (
            <Card className="rounded-3xl border border-skyblue/30 bg-skyblue/10 px-5 py-4 text-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">New posts are available</p>
                  <p className="text-sm text-slate-700">Refresh to bring the latest team updates into your feed.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => void refresh()} size="sm">
                    Refresh feed
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {error && <Card className="border border-red-200 text-red-700">{error}</Card>}

          {loading ? (
            renderSkeletons()
          ) : sortedPosts.length === 0 ? (
            buildEmptyState()
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => {
                const linkUrls = listUrls(post.body).filter((url) => !isImageUrl(url));
                const linkPreview = linkUrls.length ? linkUrls[0] : null;
                const isExpanded = expandedPostIds.includes(post.id);
                return (
                  <Card key={post.id} className="space-y-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold uppercase tracking-[0.3em] text-slate-600">
                            {post.user_id === user?.id ? 'Your post' : 'Team post'}
                          </span>
                          <span>•</span>
                          <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          <span>•</span>
                          <span>{post.commentCount ?? 0} replies</span>
                          {newReplyCounts[post.id] ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                              {newReplyCounts[post.id]} new
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Link to={`${basePath}/team-huddle/post/${post.id}`} className="break-words text-xl font-semibold text-charcoal transition hover:text-skyblue">
                            {post.title}
                          </Link>
                          {post.pinned_at ? <Badge tone="attention">Pinned</Badge> : null}
                        </div>
                        <p className={`text-sm leading-7 text-slate-700 ${isExpanded ? '' : 'line-clamp-4'}`}>
                          {renderRichBody(post.body)}
                        </p>
                        {post.body.length > 260 ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(post.id)}
                            className="text-sm font-semibold text-skyblue hover:text-skyblue/80"
                          >
                            {isExpanded ? 'See less' : 'See more'}
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant={followedPostIds.includes(post.id) ? 'primary' : 'ghost'}
                          onClick={() => toggleFollow(post.id)}
                          aria-label={followedPostIds.includes(post.id) ? 'Unfollow thread' : 'Follow thread'}
                        >
                          <Bookmark className="mr-2 h-4 w-4" />
                          {followedPostIds.includes(post.id) ? 'Following' : 'Follow'}
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`${basePath}/team-huddle/post/${post.id}`}>View thread</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
                      <div className="space-y-4">
                        {renderPostMedia(post)}
                        {linkPreview ? (
                          <a
                            href={linkPreview}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-skyblue/40 hover:bg-white"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Link preview</p>
                                <p className="mt-2 text-sm font-semibold text-charcoal">{getLinkLabel(linkPreview)}</p>
                                <p className="mt-1 text-sm text-slate-600">{getLinkSummary(linkPreview)}</p>
                              </div>
                              <ExternalLink className="h-5 w-5 text-slate-400" />
                            </div>
                          </a>
                        ) : null}
                      </div>
                      <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-charcoal">Keep the discussion moving</span>
                          <span className="rounded-full bg-white px-2 py-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                            {post.commentCount ?? 0} replies
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">Add a perspective, share what you learned, or ask a follow-up question.</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => window.location.assign(`${basePath}/team-huddle/post/${post.id}`)}>
                            View full thread
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTitle(`Re: ${post.title}`);
                              setBody(`I’d like to add to this conversation by sharing...`);
                              setTopics((prev) => prev || (post.topics || []).join(', '));
                              trackEvent('navigation_click', user?.id ?? 'anonymous', {
                                category: 'team_huddle',
                                action: 'jump_back_in_clicked',
                                postId: post.id,
                              });
                            }}
                          >
                            Add your perspective
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {reactionLabels.map((reaction) => {
                          const active = post.viewerReaction === reaction;
                          const count = post.reactionSummary?.[reaction] ?? 0;
                          return (
                            <Button
                              key={`${post.id}-${reaction}`}
                              size="sm"
                              variant={active ? 'primary' : 'ghost'}
                              onClick={() => void handleReact(post.id, reaction)}
                              aria-label={`${reaction} this post`}
                            >
                              {reaction} ({count})
                            </Button>
                          );
                        })}
                      </div>
                      <div className="text-xs text-slate-500">
                        {post.topics?.slice(0, 4).map((topic) => (
                          <Badge key={`${post.id}-${topic}`} tone="info">#{topic}</Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-skyblue" />
              <div>
                <p className="text-sm font-semibold text-charcoal">Jump back in</p>
                <p className="text-sm text-slate-600">Threads you’re following and recent work from your team.</p>
              </div>
            </div>
            {followedThreads.length > 0 ? (
              <div className="space-y-3">
                {followedThreads.slice(0, 3).map((post) => (
                  <Link
                    key={post.id}
                    to={`${basePath}/team-huddle/post/${post.id}`}
                    className="block rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-800 transition hover:border-skyblue/40 hover:bg-slate-50"
                    onClick={() => trackEvent('navigation_click', user?.id ?? 'anonymous', {
                      category: 'team_huddle',
                      action: 'thread_opened',
                      postId: post.id,
                    })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{post.title}</span>
                      {newReplyCounts[post.id] ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          {newReplyCounts[post.id]} new
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{getLinkSummary(post.body) || 'Continue the conversation'}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Follow threads to return to the discussions that matter most to you.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <Bookmark className="h-5 w-5 text-slate-700" />
              <div>
                <p className="text-sm font-semibold text-charcoal">Your recent posts</p>
                <p className="text-sm text-slate-600">A quick look at conversations you started.</p>
              </div>
            </div>
            {yourRecentPosts.length ? (
              <div className="space-y-3">
                {yourRecentPosts.slice(0, 4).map((post) => (
                  <Link key={post.id} to={`${basePath}/team-huddle/post/${post.id}`} className="block rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-800 transition hover:border-skyblue/40 hover:bg-slate-50">
                    <div className="font-semibold text-slate-900">{post.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{post.commentCount ?? 0} replies</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Once you post, your recent contributions will appear here.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <ExternalLink className="h-5 w-5 text-slate-700" />
              <div>
                <p className="text-sm font-semibold text-charcoal">Active discussions</p>
                <p className="text-sm text-slate-600">Where the team is most active right now.</p>
              </div>
            </div>
            {activeDiscussions.length ? (
              <div className="space-y-3">
                {activeDiscussions.map((post) => (
                  <Link key={post.id} to={`${basePath}/team-huddle/post/${post.id}`} className="block rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-800 transition hover:border-skyblue/40 hover:bg-slate-50">
                    <div className="font-semibold text-slate-900">{post.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{post.commentCount ?? 0} replies</span>
                      <span>•</span>
                      <span>{getLinkLabel(post.body) || 'Community conversation'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No active threads yet. Your first post can create momentum.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-skyblue" />
              <div>
                <p className="text-sm font-semibold text-charcoal">Your shared resources</p>
                <p className="text-sm text-slate-600">Recent useful resources surfaced by the team.</p>
              </div>
            </div>
            {sharedResources.length ? (
              <div className="space-y-3">
                {sharedResources.map((resource) => (
                  <a
                    key={resource.url}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-800 transition hover:border-skyblue/40 hover:bg-slate-50"
                  >
                    <div className="font-semibold text-slate-900">{resource.title}</div>
                    <div className="mt-1 text-xs text-slate-500">From: {resource.postTitle}</div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Resource shares will appear here once your team adds links or attachments.</p>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Image preview"
        ariaLabel="Open image preview"
        maxWidth="2xl"
      >
        {previewImage ? (
          <img src={previewImage} alt="Expanded preview" className="max-h-[70vh] w-full object-contain" />
        ) : null}
      </Modal>
    </div>
  );
};

export default TeamHuddleFeedPage;
