import React, { useEffect, useState } from 'react';
import useNavTrace from '../../hooks/useNavTrace';
import { apiRequest } from '../../utils/apiClient';

interface EditableTextItem {
  key: string;
  value: string;
}

const AdminWebpageEditor: React.FC = () => {
  useNavTrace('AdminWebpageEditor');
  const [textItems, setTextItems] = useState<EditableTextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiRequest<{ data: EditableTextItem[] }>('/api/text-content', { noTransform: true })
      .then((payload) => {
        setTextItems(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch(() => {
        setError('Failed to load content');
      })
      .finally(() => {
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
    apiRequest('/api/text-content', {
      method: 'PUT',
      body: textItems,
    })
      .then(() => {
        setSuccess(true);
      })
      .catch(() => {
        setError('Failed to save');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <div className="max-w-3xl mx-auto mt-8 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Edit Website Text</h1>
      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && error && <div className="text-red-500 mb-4">{error}</div>}
      {!loading && (
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
      )}
    </div>
  );
};

export default AdminWebpageEditor;
