import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { createOrg } from '../../dal/orgs';

const AdminOrganizationCreate: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState('Corporate');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [status, setStatus] = useState<'active'|'inactive'>('active');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
  const created = await createOrg({ name, type, contactPerson, contactEmail, status });
      navigate(`/admin/organizations/${created.id}`);
    } catch (err) {
      console.error('Failed to create org', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center space-x-3">
        <div className="bg-green-50 p-2 rounded">
          <Plus className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Create Organization</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 gap-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Organization name" className="p-3 border rounded" />
          <input value={type} onChange={e => setType(e.target.value)} placeholder="Type (e.g. Corporate)" className="p-3 border rounded" />
          <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Contact person" className="p-3 border rounded" />
          <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Contact email" className="p-3 border rounded" />
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="p-3 border rounded">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex items-center justify-end">
            <button type="submit" disabled={saving} className="bg-orange-500 text-white px-4 py-2 rounded-lg">
              {saving ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminOrganizationCreate;
