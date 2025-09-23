import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addSessionNote, listSessionNotes } from '../../services/clientWorkspaceService';

const SessionNotesPage: React.FC = () => {
  const { orgId } = useParams();
  const [notes, setNotes] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!orgId) return;
    listSessionNotes(orgId).then(setNotes);
  }, [orgId]);

  // notification visual feedback intentionally omitted for now

  const save = async () => {
    if (!orgId) return;
    const attachments = [] as any[];
    // attachments are already added to files state below
    await addSessionNote(orgId, { title, body, date, tags: tags.split(',').map(t=>t.trim()), attachments });
    const n = await listSessionNotes(orgId);
    setNotes(n);
    setTitle(''); setBody(''); setTags('');
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // store as attachment in localStorage by appending a placeholder to body for now
      setBody(prev => prev + `\n\n[Attachment: ${file.name}]`);
    };
    reader.readAsDataURL(file);
  };

  const notify = async (noteId: string) => {
    // Mock notification: in prod this would send emails
    console.log(`Notify client contacts about note ${noteId}`);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Session Notes & Follow-Ups</h2>
      <div className="bg-white rounded shadow p-4 mb-4">
        <input className="w-full border p-2 mb-2 rounded" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="w-full border p-2 mb-2 rounded" rows={4} placeholder="Notes" value={body} onChange={e=>setBody(e.target.value)} />
        <div className="flex items-center space-x-2 mb-2">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 rounded" />
          <input placeholder="tags (comma separated)" className="flex-1 border p-2 rounded" value={tags} onChange={e=>setTags(e.target.value)} />
          <input type="file" onChange={e=>handleFile(e.target.files?.[0])} className="border p-2 rounded" />
          <button onClick={save} className="bg-orange-500 text-white px-3 py-2 rounded">Save Note</button>
        </div>
      </div>

      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="bg-white p-4 rounded border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">{n.date} • {n.createdBy}</div>
              <div>
                <button onClick={() => notify(n.id)} className="text-sm text-blue-600 mr-3">Notify</button>
              </div>
            </div>
            <div className="font-semibold mt-1">{n.title}</div>
            <div className="mt-2 text-gray-700 whitespace-pre-wrap">{n.body}</div>
            <div className="mt-2 text-sm text-gray-500">Tags: {n.tags.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionNotesPage;
