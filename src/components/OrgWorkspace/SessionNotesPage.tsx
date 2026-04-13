import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import type { SessionAttachment, SessionNote } from '../../dal/clientWorkspace';

const SessionNotesPage: React.FC = () => {
  const { orgId } = useParams();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState('');
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const svc = await import('../../dal/clientWorkspace');
        const loadedNotes = await svc.listSessionNotes(orgId as string);
        setNotes(loadedNotes);
      } catch (error) {
        console.error('Failed to load session notes', error);
        showToast('Unable to load session notes right now.', 'error');
      }
    })();
  }, [orgId, showToast]);

  const save = async () => {
    if (!orgId) return;
    if (!title.trim() || !body.trim()) {
      showToast('Add both a title and note body before saving.', 'error');
      return;
    }

    setSaving(true);
    try {
      const svc = await import('../../dal/clientWorkspace');
      await svc.addSessionNote(orgId, {
        title: title.trim(),
        body: body.trim(),
        date,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        attachments,
      });
      const loadedNotes = await svc.listSessionNotes(orgId as string);
      setNotes(loadedNotes);
      setTitle('');
      setBody('');
      setTags('');
      setAttachments([]);
      showToast('Session note saved.', 'success');
    } catch (error) {
      console.error('Failed to save session note', error);
      showToast('Unable to save this note right now.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const attachmentId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAttachments((current) => [...current, { id: attachmentId, name: file.name }]);
    showToast(`Attached ${file.name}.`, 'info');
  };

  const copyNoteSummary = async (note: SessionNote) => {
    const summary = `${note.title}\n${note.date}\n\n${note.body}\n\nTags: ${note.tags.join(', ') || 'None'}`;
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Note summary copied to clipboard.', 'success');
    } catch (error) {
      console.error('Failed to copy note summary', error);
      showToast('Unable to copy the note summary.', 'error');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Session Notes & Follow-Ups</h2>
      <div className="bg-white rounded shadow p-4 mb-4">
        <input className="w-full border p-2 mb-2 rounded" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border p-2 mb-2 rounded" rows={4} placeholder="Notes" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex items-center space-x-2 mb-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border p-2 rounded" />
          <input placeholder="tags (comma separated)" className="flex-1 border p-2 rounded" value={tags} onChange={(e) => setTags(e.target.value)} />
          <input type="file" onChange={(e) => handleFile(e.target.files?.[0])} className="border p-2 rounded" />
          <button onClick={save} disabled={saving} className="bg-orange-500 text-white px-3 py-2 rounded disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            {attachments.map((attachment) => (
              <span key={attachment.id} className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
                {attachment.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="bg-white p-4 rounded border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">{note.date} • {note.createdBy}</div>
              <div>
                <button onClick={() => void copyNoteSummary(note)} className="text-sm text-blue-600 mr-3">
                  Copy Summary
                </button>
              </div>
            </div>
            <div className="font-semibold mt-1">{note.title}</div>
            <div className="mt-2 text-gray-700 whitespace-pre-wrap">{note.body}</div>
            <div className="mt-2 text-sm text-gray-500">Tags: {note.tags.join(', ') || 'None'}</div>
            {note.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                {note.attachments.map((attachment) => (
                  <span key={attachment.id} className="rounded-full bg-slate-100 px-3 py-1">
                    {attachment.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionNotesPage;
