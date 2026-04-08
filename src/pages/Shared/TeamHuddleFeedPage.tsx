import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
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

const reactionLabels: TeamHuddleReactionType[] = ['like', 'love', 'dislike'];

const TeamHuddleFeedPage = ({ basePath, heading }: TeamHuddleFeedPageProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<TeamHuddlePost[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topics, setTopics] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async (nextSearch = search) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTeamHuddlePosts({ search: nextSearch });
      setPosts(rows);
    } catch (err) {
      console.error('Failed to load Team Huddle posts', err);
      setError('Unable to load Team Huddle right now.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const totalConversations = useMemo(() => posts.length, [posts.length]);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await createTeamHuddlePost({
        title,
        body,
        topics: topics
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setTitle('');
      setBody('');
      setTopics('');
      await refresh();
    } catch (err) {
      console.error('Failed to create Team Huddle post', err);
      setError('Unable to publish your post. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReact = async (postId: string, reactionType: TeamHuddleReactionType) => {
    try {
      const next = await reactToTeamHuddlePost(postId, reactionType);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactionSummary: next.reactionSummary,
                viewerReaction: next.viewerReaction,
              }
            : post,
        ),
      );
    } catch (err) {
      console.error('Failed to react to Team Huddle post', err);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Card tone="gradient" withBorder={false} className="space-y-3">
        <h1 className="font-heading text-3xl font-bold text-charcoal">{heading}</h1>
        <p className="text-sm text-slate/80">
          A private space for your organization to share ideas, ask for help, and celebrate wins.
        </p>
        <div className="flex items-center gap-3 text-sm text-slate/70">
          <MessageCircle className="h-4 w-4" />
          <span>{totalConversations} active conversations</span>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Start a conversation</h2>
        <Input placeholder="Post title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Share an update, ask a question, or invite feedback..."
          className="min-h-[120px] w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm text-charcoal shadow-inner focus:border-skyblue/40 focus:outline-none"
        />
        <Input
          placeholder="Topics (comma separated, e.g. onboarding, communication)"
          value={topics}
          onChange={(event) => setTopics(event.target.value)}
        />
        <Button onClick={handleCreate} disabled={saving || !title.trim() || !body.trim()}>
          {saving ? 'Posting...' : 'Post to Team Huddle'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-slate/70" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search posts by title, text, or topic"
          />
          <Button variant="ghost" onClick={() => void refresh(search)}>Search</Button>
        </div>
      </Card>

  {error && <Card className="border border-red-200 text-red-700">{error}</Card>}

      {loading ? (
        <Card>Loading Team Huddle…</Card>
      ) : posts.length === 0 ? (
        <Card>No posts yet. Be the first to start the conversation.</Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`${basePath}/team-huddle/post/${post.id}`} className="font-heading text-xl font-semibold text-charcoal no-underline hover:text-skyblue">
                  {post.title}
                </Link>
                <span className="text-xs text-slate/60">{new Date(post.created_at).toLocaleString()}</span>
              </div>
              <p className="line-clamp-3 text-sm text-slate/80">{post.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                {(post.topics || []).map((topic) => (
                  <Badge key={`${post.id}-${topic}`} tone="info">#{topic}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {reactionLabels.map((reaction) => {
                    const active = post.viewerReaction === reaction;
                    const count = post.reactionSummary?.[reaction] ?? 0;
                    return (
                      <Button
                        key={`${post.id}-${reaction}`}
                        size="sm"
                        variant={active ? 'primary' : 'ghost'}
                        onClick={() => void handleReact(post.id, reaction)}
                      >
                        {reaction} ({count})
                      </Button>
                    );
                  })}
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`${basePath}/team-huddle/post/${post.id}`}>
                    View thread ({post.commentCount ?? 0})
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamHuddleFeedPage;
