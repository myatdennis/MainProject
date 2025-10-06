import React, { useEffect, useState } from 'react';

interface EditableTextItem {
  key: string;
  value: string;
}

const AdminWebpageEditor: React.FC = () => {
  const [textItems, setTextItems] = useState<EditableTextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/text-content')
      .then(res => res.json())
      .then(data => {
        setTextItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load content');
        setLoading(false);
      });
  }, []);

  const handleChange = (key: string, value: string) => {
    setTextItems(items => items.map(item =>
      item.key === key ? { ...item, value } : item
    ));
    setSuccess(false);
    setError(null);
  };

  const handleSave = () => {
    setSaving(true);
    fetch('/api/text-content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textItems)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save');
        setSuccess(true);
        setSaving(false);
      })
      .catch(() => {
        setError('Failed to save');
        setSaving(false);
      });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto mt-8 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Edit Website Text</h1>
      <form>
        {textItems.map(item => (
          <div key={item.key} className="mb-6">
            <label className="font-semibold text-gray-800">{item.key}</label>
            <textarea
              className="w-full border rounded mt-2 p-2"
              value={item.value}
              onChange={e => handleChange(item.key, e.target.value)}
              rows={2}
            />
          </div>
        ))}
        <button
          type="button"
          className="bg-blue-500 text-white px-6 py-2 rounded font-semibold"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {success && <div className="text-green-500 mt-2">Saved!</div>}
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </form>
    </div>
  );
};

export default AdminWebpageEditor;