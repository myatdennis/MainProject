import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Building2 } from 'lucide-react';
import documentService from '../../dal/documents';
// clientWorkspaceService is dynamically imported where used so it can be bundled with the org-workspace chunk
import notificationService from '../../dal/notifications';
import orgService from '../../dal/orgs';
import { useToast } from '../../context/ToastContext';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'services', label: 'Services' },
  { key: 'resources', label: 'Resources' },
  { key: 'action-tracker', label: 'Action Tracker' },
  { key: 'metrics', label: 'Metrics' }
];

const AdminOrganizationProfile: React.FC = () => {
  const { orgId } = useParams();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [documents, setDocuments] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [strategicPlansCount, setStrategicPlansCount] = useState<number>(0);
  const [totalLearners, setTotalLearners] = useState<number | null>(null);
  const [avgCompletion, setAvgCompletion] = useState<number | null>(null);
  const [totalDownloads, setTotalDownloads] = useState<number>(0);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>('');
  const [docCategory, setDocCategory] = useState<string>('Onboarding');
  const [docTags, setDocTags] = useState<string>('');

  // Action item form
  const [newActionTitle, setNewActionTitle] = useState<string>('');
  const [newActionDue, setNewActionDue] = useState<string>('');
  const [newActionAssignee, setNewActionAssignee] = useState<string>('');

  useEffect(() => {
    if (!orgId) return;
    // load documents for resources tab
    documentService.listDocuments({ orgId }).then(setDocuments).catch(() => setDocuments([]));
    // load action items
    (async () => {
      try {
        const svc = await import('../../services/clientWorkspaceService');
        const actions = await svc.listActionItems(orgId);
        setActionItems(actions);
        const plans = await svc.listStrategicPlans(orgId);
        setStrategicPlansCount(plans.length);
      } catch (e) {
        setActionItems([]);
        setStrategicPlansCount(0);
      }
    })();
    // org totals
    orgService.getOrg(orgId).then(o => {
      if (o) {
        setTotalLearners(o.totalLearners || 0);
        setAvgCompletion(o.completionRate || 0);
      } else {
        setTotalLearners(null); setAvgCompletion(null);
      }
    }).catch(() => { setTotalLearners(null); setAvgCompletion(null); });
    // document downloads aggregate
    documentService.listDocuments({ orgId }).then(list => setTotalDownloads(list.reduce((acc, d) => acc + (d.downloadCount || 0), 0))).catch(() => setTotalDownloads(0));
  }, [orgId]);

  const handleAssignDocument = async () => {
    // quick demo: create a placeholder doc and assign to org
    const meta = await documentService.addDocument({
      name: `welcome-packet-${Date.now()}`,
      filename: 'welcome.pdf',
      url: undefined,
      category: 'Onboarding',
      subcategory: undefined,
      tags: ['welcome'],
      fileType: 'application/pdf',
      visibility: 'org',
      orgId: orgId!,
      createdBy: 'Admin'
    } as any);
    if (meta && meta.id) {
      await documentService.assignToOrg(meta.id, orgId!);
      // notificationService API is addNotification and expects body
      await notificationService.addNotification({
        title: 'Document assigned',
        body: `Assigned ${meta.name} to organization ${orgId}`,
        orgId: orgId!
      } as any);
      // refresh
      const list = await documentService.listDocuments({ orgId });
      setDocuments(list);
    }
  };

  const handleFileChange = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    if (!orgId) return;
    if (!file && !docName) {
      showToast('Provide a name or file', 'error');
      return;
    }

    let url: string | undefined = undefined;
    if (file) {
      // read as data URL for local dev (documentService will also attempt storage upload)
      url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }

    const doc = await documentService.addDocument({
      name: docName || file!.name,
      filename: file?.name,
      url,
      category: docCategory,
      subcategory: undefined,
      tags: docTags ? docTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      fileType: file?.type,
      visibility: 'org',
      orgId: orgId!,
      createdBy: 'Admin'
    } as any, file || undefined);

    if (doc && doc.id) {
      await documentService.assignToOrg(doc.id, orgId!);
      await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with your organization.`, orgId: orgId! } as any);
      setDocName(''); setFile(null); setDocTags('');
      const list = await documentService.listDocuments({ orgId });
      setDocuments(list);
    }
  };

  const handleAddAction = async () => {
    if (!orgId || !newActionTitle) {
      showToast('Provide a title for the action', 'error');
      return;
    }
    const svc = await import('../../services/clientWorkspaceService');
    await svc.addActionItem(orgId, {
      title: newActionTitle,
      description: '',
      assignee: newActionAssignee || undefined,
      dueDate: newActionDue || undefined,
      status: 'Not Started'
    } as any);
    setNewActionTitle(''); setNewActionDue(''); setNewActionAssignee('');
    const list = await (await import('../../services/clientWorkspaceService')).listActionItems(orgId);
    setActionItems(list);
    showToast('Action item added', 'success');
  };

  const toggleActionStatus = async (item: any) => {
    if (!orgId) return;
    const order = ['Not Started','In Progress','Completed'];
    const idx = order.indexOf(item.status || 'Not Started');
    const next = order[(idx + 1) % order.length] as any;
    const updated = { ...item, status: next };
    const svc2 = await import('../../services/clientWorkspaceService');
    await svc2.updateActionItem(orgId, updated);
    const list = await svc2.listActionItems(orgId);
    setActionItems(list);
  };

  const renderOverview = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-start space-x-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Organization {orgId}</h2>
          <p className="text-gray-600 mt-2">Basic organization information and contact details will appear here.</p>
          <div className="mt-3">
            <Button asChild variant="ghost" size="sm" aria-label="Back to Organizations">
              <Link to="/admin/organizations">Back to Organizations</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderServices = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="font-bold text-lg mb-2">Services</h3>
      <p className="text-sm text-gray-600">List and configure services provided to this organization.</p>
      <div className="mt-4">
        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg">Edit Services</button>
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Resources</h3>
        <div className="flex items-center space-x-2">
          <button onClick={handleAssignDocument} className="px-3 py-1 bg-blue-600 text-white rounded-lg">Assign Demo Document</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          {documents.length === 0 ? (
            <div className="text-sm text-gray-500">No documents assigned to this organization.</div>
          ) : (
            <ul className="space-y-2">
              {documents.map(doc => (
                <li key={doc.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium">{doc.name}</div>
                    <div className="text-sm text-gray-600">{doc.filename || doc.category}</div>
                  </div>
                  <div className="text-sm text-gray-500">{doc.visibility}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border rounded-lg">
          <div className="text-sm font-medium mb-2">Upload & Assign</div>
          <input type="text" placeholder="Document name" value={docName} onChange={e => setDocName(e.target.value)} className="w-full mb-2 p-2 border rounded" />
          <input type="text" placeholder="Category" value={docCategory} onChange={e => setDocCategory(e.target.value)} className="w-full mb-2 p-2 border rounded" />
          <input type="text" placeholder="Tags (comma separated)" value={docTags} onChange={e => setDocTags(e.target.value)} className="w-full mb-2 p-2 border rounded" />
          <input type="file" onChange={e => handleFileChange(e.target.files?.[0] || null)} className="w-full mb-2" />
          <div className="text-right">
            <button onClick={handleUpload} className="px-3 py-1 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded">Upload & Share</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActionTracker = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Action Tracker</h3>
      </div>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input value={newActionTitle} onChange={e => setNewActionTitle(e.target.value)} placeholder="Action title" className="p-2 border rounded" />
        <input value={newActionDue} onChange={e => setNewActionDue(e.target.value)} placeholder="Due date" type="date" className="p-2 border rounded" />
        <input value={newActionAssignee} onChange={e => setNewActionAssignee(e.target.value)} placeholder="Assignee" className="p-2 border rounded" />
        <div className="md:col-span-3 text-right">
          <button onClick={handleAddAction} className="px-3 py-1 bg-blue-600 text-white rounded">Add Action</button>
        </div>
      </div>

      {actionItems.length === 0 ? (
        <div className="text-sm text-gray-500">No action items for this organization.</div>
      ) : (
        <ul className="space-y-2">
          {actionItems.map(item => (
            <li key={item.id} className="p-3 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-gray-600">Due: {item.dueDate || '—'}</div>
                <div className="text-xs text-gray-500">Assignee: {item.assignee || 'Unassigned'}</div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className={`px-2 py-1 rounded-full text-sm ${item.status === 'Completed' ? 'bg-green-100 text-green-800' : item.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</div>
                <div className="flex space-x-2">
                  <button onClick={() => toggleActionStatus(item)} className="px-2 py-1 bg-white border rounded text-sm">Toggle Status</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderMetrics = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="font-bold text-lg mb-2">Metrics</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Documents</div>
          <div className="text-2xl font-bold">{documents.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Learners</div>
          <div className="text-2xl font-bold">{totalLearners === null ? '—' : totalLearners}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Action Items</div>
          <div className="text-2xl font-bold">{actionItems.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-2xl font-bold">{
            actionItems.length === 0 ? '—' : `${Math.round((actionItems.filter(a => a.status === 'Completed').length / actionItems.length) * 100)}%`
          }</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Avg Completion</div>
          <div className="text-2xl font-bold">{avgCompletion === null ? '—' : `${avgCompletion}%`}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Strategic Plans</div>
          <div className="text-2xl font-bold">{strategicPlansCount}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Downloads</div>
          <div className="text-2xl font-bold">{totalDownloads}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organization Profile</h1>
          <p className="text-sm text-gray-600">Manage organization details, resources and activity.</p>
        </div>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'services' && renderServices()}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'action-tracker' && renderActionTracker()}
        {activeTab === 'metrics' && renderMetrics()}
      </div>
    </div>
  );
};

export default AdminOrganizationProfile;
