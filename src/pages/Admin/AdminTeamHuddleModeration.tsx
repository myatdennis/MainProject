import { useEffect, useState } from 'react';
import { Flag, ShieldAlert } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Loading from '../../components/ui/Loading';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { listTeamHuddleReports, moderateTeamHuddlePost, type TeamHuddleReport } from '../../dal/teamHuddle';

const AdminTeamHuddleModeration = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<TeamHuddleReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTeamHuddleReports();
      setReports(rows);
    } catch (err) {
      console.error('Failed to load Team Huddle reports', err);
      setError('Unable to load Team Huddle moderation queue.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runModeration = async (postId: string, action: 'hide' | 'remove' | 'lock' | 'pin') => {
    try {
      await moderateTeamHuddlePost(postId, action);
      await refresh();
    } catch (err) {
      console.error('Team Huddle moderation action failed', err);
      setError('Unable to apply moderation action.');
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Team Huddle Moderation', to: '/admin/team-huddle/moderation' }]} />
      <Card tone="gradient" withBorder={false} className="space-y-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-skyblue" />
          <h1 className="font-heading text-3xl font-bold text-charcoal">Team Huddle Moderation</h1>
        </div>
        <p className="text-sm text-slate/80">
          Review reported posts, apply moderation controls, and keep conversations safe and constructive.
        </p>
      </Card>

      {error && <Card className="border border-red-200 text-red-700">{error}</Card>}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loading text="Loading moderation queue…" />
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No active reports" description="Great work — no flagged posts right now." />
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-sunrise" />
                  <h2 className="font-heading text-xl font-semibold text-charcoal">{report.post?.title || 'Reported post'}</h2>
                </div>
                <Badge tone={report.status === 'open' ? 'attention' : 'positive'}>{report.status}</Badge>
              </div>
              <p className="text-sm text-slate/80"><span className="font-semibold">Reason:</span> {report.reason}</p>
              {report.post?.body && <p className="line-clamp-3 text-sm text-slate/70">{report.post.body}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => void runModeration(report.post_id, 'hide')}>Hide</Button>
                <Button size="sm" variant="ghost" onClick={() => void runModeration(report.post_id, 'lock')}>Lock</Button>
                <Button size="sm" variant="ghost" onClick={() => void runModeration(report.post_id, 'pin')}>Pin</Button>
                <Button size="sm" onClick={() => void runModeration(report.post_id, 'remove')}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTeamHuddleModeration;
