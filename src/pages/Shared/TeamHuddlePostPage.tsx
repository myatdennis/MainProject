import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  addTeamHuddleComment,
  getTeamHuddlePost,
  reportTeamHuddlePost,
  type TeamHuddlePost,
} from '../../dal/teamHuddle';

interface TeamHuddlePostPageProps {
  basePath: '/client' | '/lms';
}

const TeamHuddlePostPage = ({ basePath }: TeamHuddlePostPageProps) => {
  const { postId = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<TeamHuddlePost | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getTeamHuddlePost(postId);
      setPost(row);
    } catch (err) {
      console.error('Failed to load Team Huddle post', err);
      setError('Unable to load this post right now.');
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [postId]);

  const sortedComments = useMemo(
    () => [...(post?.comments || [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [post?.comments],
  );

  const handleAddComment = async () => {
    if (!postId || !commentBody.trim()) return;
    try {
      await addTeamHuddleComment(postId, { body: commentBody });
      setCommentBody('');
      await refresh();
    } catch (err) {
      console.error('Failed to add Team Huddle comment', err);
      setError('Unable to add your comment. Please try again.');
    }
  };

  const handleReport = async () => {
    if (!postId || !reportReason.trim()) return;
    try {
      await reportTeamHuddlePost(postId, reportReason);
      setReportReason('');
    } catch (err) {
      console.error('Failed to report Team Huddle post', err);
      setError('Unable to submit your report. Please try again.');
    }
  };

  if (loading) {
    return <div className="container mx-auto max-w-4xl px-4 py-6"><Card>Loading post…</Card></div>;
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
      <Card className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`${basePath}/team-huddle`}>← Back to Team Huddle</Link>
        </Button>
        <h1 className="font-heading text-3xl font-bold text-charcoal">{post.title}</h1>
        <p className="text-sm text-slate/60">Posted {new Date(post.created_at).toLocaleString()}</p>
        <p className="whitespace-pre-wrap text-sm text-slate/80">{post.body}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Reply</h2>
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          placeholder="Share a helpful reply…"
          className="min-h-[100px] w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm text-charcoal shadow-inner focus:border-skyblue/40 focus:outline-none"
        />
        <Button onClick={() => void handleAddComment()} disabled={!commentBody.trim()}>
          Add comment
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Comments ({sortedComments.length})</h2>
        {sortedComments.length === 0 ? (
          <p className="text-sm text-slate/70">No comments yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedComments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-mist/80 bg-cloud/40 p-3">
                <p className="whitespace-pre-wrap text-sm text-slate/80">{comment.body}</p>
                <p className="mt-2 text-xs text-slate/60">{new Date(comment.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Report this post</h2>
        <Input
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          placeholder="Reason for report (harassment, spam, etc.)"
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
