import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const StrategicPlansPage: React.FC = () => {
  const { orgId } = useParams();
  const [versions, setVersions] = useState<any[]>([]);
  const [editor, setEditor] = useState('');

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const svc = await import('../../services/clientWorkspaceService');
      const list = await svc.listStrategicPlans(orgId as string);
      setVersions(list);
    })();
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
    const svc = await import('../../services/clientWorkspaceService');
    await svc.addStrategicPlanVersion(orgId, editor, 'Huddle Co.');
    const v = await svc.listStrategicPlans(orgId as string);
    setVersions(v);
    setEditor('');
  };

  const remove = async (id: string) => {
    if (!orgId) return;
    const svc = await import('../../services/clientWorkspaceService');
    await svc.deleteStrategicPlanVersion(orgId, id);
    setVersions(await svc.listStrategicPlans(orgId as string));
  };

  const restore = async (id: string) => {
    if (!orgId) return;
    const { getStrategicPlanVersion, addStrategicPlanVersion } = await import('../../services/clientWorkspaceService');
    const v = await getStrategicPlanVersion(orgId, id);
    if (v) {
      // when restoring, we create a new version from the selected content
      await addStrategicPlanVersion(orgId, v.content, 'Restored Version');
      const svc = await import('../../services/clientWorkspaceService');
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
                  <button onClick={() => remove(v.id)} className="text-sm text-red-600">Delete</button>
                </div>
              </div>
              <div className="mt-2 prose max-w-none" dangerouslySetInnerHTML={{ __html: v.content }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StrategicPlansPage;
