import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const ActionTrackerPage: React.FC = () => {
  const { orgId } = useParams();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const svc = await import('../../services/clientWorkspaceService');
      const i = await svc.listActionItems(orgId as string);
      setItems(i);
    })();
  }, [orgId]);

  const create = async () => {
    if (!orgId || !title) return;
  const svc = await import('../../services/clientWorkspaceService');
  await svc.addActionItem(orgId, { title, assignee, dueDate, status: 'Not Started' });
  const i = await svc.listActionItems(orgId as string);
    setItems(i);
    setTitle(''); setAssignee(''); setDueDate('');
  };

  const notify = async (item: any) => {
    console.log(`Notify about action ${item.id} -> assignee: ${item.assignee || 'unassigned'}`);
    alert(`Notification sent to ${item.assignee || 'client contacts'} (mock)`);
  };

  const exportCSV = () => {
    const rows = [['Title','Assignee','Due Date','Status']].concat(items.map(i=>[i.title,i.assignee||'',i.dueDate||'',i.status]));
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `action-tracker-${orgId || 'org'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleStatus = async (item: any) => {
  const next = item.status === 'Completed' ? 'Not Started' : item.status === 'Not Started' ? 'In Progress' : 'Completed';
  const updated = { ...item, status: next };
  const svc = await import('../../services/clientWorkspaceService');
  await svc.updateActionItem(orgId!, updated);
  setItems(await svc.listActionItems(orgId!));
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Shared Action Tracker</h2>
      <div className="flex justify-end mb-2">
        <button onClick={exportCSV} className="text-sm px-3 py-1 border rounded">Export CSV</button>
      </div>
      <div className="bg-white rounded p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input placeholder="Action title" className="border p-2 rounded" value={title} onChange={e=>setTitle(e.target.value)} />
          <input placeholder="Assignee" className="border p-2 rounded" value={assignee} onChange={e=>setAssignee(e.target.value)} />
          <input type="date" className="border p-2 rounded" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
        </div>
        <div className="flex justify-end mt-2">
          <button className="bg-orange-500 text-white px-4 py-2 rounded" onClick={create}>Add Action</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map(it => (
          <div key={it.id} className="bg-white p-3 rounded border flex items-center justify-between">
            <div>
              <div className="font-semibold">{it.title}</div>
              <div className="text-sm text-gray-600">{it.assignee || 'Unassigned'} • Due: {it.dueDate || '—'}</div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm ${it.status === 'Completed' ? 'bg-green-100 text-green-800' : it.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{it.status}</div>
              <button className="px-3 py-1 border rounded" onClick={()=>toggleStatus(it)}>Toggle</button>
              <button className="px-3 py-1 border rounded" onClick={()=>notify(it)}>Notify</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionTrackerPage;
