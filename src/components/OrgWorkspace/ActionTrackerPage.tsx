import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import type { ActionItem } from '../../dal/clientWorkspace';

const ActionTrackerPage: React.FC = () => {
  const { orgId } = useParams();
  const { showToast } = useToast();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const svc = await import('../../dal/clientWorkspace');
        const loadedItems = await svc.listActionItems(orgId as string);
        setItems(loadedItems);
      } catch (error) {
        console.error('Failed to load action items', error);
        showToast('Unable to load the action tracker right now.', 'error');
      }
    })();
  }, [orgId, showToast]);

  const create = async () => {
    if (!orgId) return;
    if (!title.trim()) {
      showToast('Add an action title before saving.', 'error');
      return;
    }

    setSaving(true);
    try {
      const svc = await import('../../dal/clientWorkspace');
      await svc.addActionItem(orgId, {
        title: title.trim(),
        assignee: assignee.trim() || undefined,
        dueDate: dueDate || undefined,
        status: 'Not Started',
      });
      const loadedItems = await svc.listActionItems(orgId as string);
      setItems(loadedItems);
      setTitle('');
      setAssignee('');
      setDueDate('');
      showToast('Action item added.', 'success');
    } catch (error) {
      console.error('Failed to add action item', error);
      showToast('Unable to add this action item right now.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyReminder = async (item: ActionItem) => {
    const reminder = `${item.title}\nAssignee: ${item.assignee || 'Unassigned'}\nDue: ${item.dueDate || 'No due date'}\nStatus: ${item.status}`;
    try {
      await navigator.clipboard.writeText(reminder);
      showToast('Reminder copied to clipboard.', 'success');
    } catch (error) {
      console.error('Failed to copy reminder', error);
      showToast('Unable to copy the reminder.', 'error');
    }
  };

  const exportCSV = () => {
    const rows = [['Title', 'Assignee', 'Due Date', 'Status']].concat(
      items.map((item) => [item.title, item.assignee || '', item.dueDate || '', item.status]),
    );
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action-tracker-${orgId || 'org'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Action tracker exported.', 'success');
  };

  const toggleStatus = async (item: ActionItem) => {
    if (!orgId) return;
    const next =
      item.status === 'Completed' ? 'Not Started' : item.status === 'Not Started' ? 'In Progress' : 'Completed';
    try {
      const updated = { ...item, status: next };
      const svc = await import('../../dal/clientWorkspace');
      await svc.updateActionItem(orgId, updated);
      setItems(await svc.listActionItems(orgId));
      showToast(`Action marked ${next}.`, 'success');
    } catch (error) {
      console.error('Failed to update action status', error);
      showToast('Unable to update this action item.', 'error');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Shared Action Tracker</h2>
      <div className="flex justify-end mb-2">
        <button onClick={exportCSV} className="text-sm px-3 py-1 border rounded">Export CSV</button>
      </div>
      <div className="bg-white rounded p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input placeholder="Action title" className="border p-2 rounded" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Assignee" className="border p-2 rounded" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          <input type="date" className="border p-2 rounded" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex justify-end mt-2">
          <button className="bg-orange-500 text-white px-4 py-2 rounded disabled:opacity-60" onClick={create} disabled={saving}>
            {saving ? 'Saving…' : 'Add Action'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="bg-white p-3 rounded border flex items-center justify-between">
            <div>
              <div className="font-semibold">{it.title}</div>
              <div className="text-sm text-gray-600">{it.assignee || 'Unassigned'} • Due: {it.dueDate || '—'}</div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm ${it.status === 'Completed' ? 'bg-green-100 text-green-800' : it.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{it.status}</div>
              <button className="px-3 py-1 border rounded" onClick={() => void toggleStatus(it)}>Toggle</button>
              <button className="px-3 py-1 border rounded" onClick={() => void copyReminder(it)}>Copy Reminder</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionTrackerPage;
