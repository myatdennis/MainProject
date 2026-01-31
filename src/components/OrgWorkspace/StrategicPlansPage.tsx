import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

const StrategicPlansPage: React.FC = () => {
  const { orgId } = useParams();
  const [versions, setVersions] = useState<any[]>([]);
  const [editor, setEditor] = useState('');
  const { showToast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
  const svc = await import('../../dal/clientWorkspace');
      const list = await svc.listStrategicPlans(orgId as string);
      setVersions(list);
    })();
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
  const svc = await import('../../dal/clientWorkspace');
    await svc.addStrategicPlanVersion(orgId, editor, 'Huddle Co.');
    const v = await svc.listStrategicPlans(orgId as string);
    setVersions(v);
    setEditor('');
  };

  const confirmDelete = async () => {
    if (!orgId || !pendingDelete) return;
    setDeletingPlan(true);
    try {
      const svc = await import('../../dal/clientWorkspace');
      await svc.deleteStrategicPlanVersion(orgId, pendingDelete.id);
      const refreshed = await svc.listStrategicPlans(orgId as string);
      setVersions(refreshed);
      showToast('Deleted strategic plan version.', 'success');
      setPendingDelete(null);
    } catch (error) {
      console.error('Failed to delete strategic plan version', error);
      showToast('Unable to delete this plan. Please try again.', 'error');
    } finally {
      setDeletingPlan(false);
    }
  };

  const restore = async (id: string) => {
    if (!orgId) return;
  const { getStrategicPlanVersion, addStrategicPlanVersion } = await import('../../dal/clientWorkspace');
    const v = await getStrategicPlanVersion(orgId, id);
    if (v) {
      // when restoring, we create a new version from the selected content
      await addStrategicPlanVersion(orgId, v.content, 'Restored Version');
  const svc = await import('../../dal/clientWorkspace');
      setVersions(await svc.listStrategicPlans(orgId as string));
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Strategic Plan Drafts</h2>
      <div className="mb-4">
        <textarea className="w-full p-3 border rounded" rows={8} value={editor} onChange={(e) => setEditor(e.target.value)} placeholder="Paste or write your strategic plan draft here (markdown supported)" />
        <div className="flex justify-end mt-2">
          <button onClick={save} className="bg-orange-500 text-white px-4 py-2 rounded">Save Version</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-2">Versions</h3>
        {versions.length === 0 && <div className="text-sm text-gray-500">No versions yet.</div>}
        <ul className="space-y-3">
          {versions.map(v => (
            <li key={v.id} className="border p-3 rounded">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">{new Date(v.createdAt).toLocaleString()} • {v.createdBy}</div>
                <div className="space-x-2">
                  <button onClick={() => restore(v.id)} className="text-sm text-blue-600">Restore</button>
                  <button
                    onClick={() => setPendingDelete(v)}
                    className="text-sm text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deletingPlan && pendingDelete?.id === v.id}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 prose max-w-none" dangerouslySetInnerHTML={{ __html: v.content }} />
            </li>
          ))}
        </ul>
      </div>
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Confirm delete</h3>
            <p className="mt-3 text-sm text-gray-600">
              Delete the strategic plan version from{' '}
              {pendingDelete.createdAt ? new Date(pendingDelete.createdAt).toLocaleString() : 'this entry'} by{' '}
              {pendingDelete.createdBy ?? 'Unknown author'} for workspace {orgId}? This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => !deletingPlan && setPendingDelete(null)}
                disabled={deletingPlan}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void confirmDelete()}
                disabled={deletingPlan}
              >
                {deletingPlan ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategicPlansPage;
