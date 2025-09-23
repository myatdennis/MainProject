// Local-first client workspace service for development
// Stores org workspaces under localStorage key `huddle_org_workspace_<orgId>`
type StrategicPlanVersion = {
  id: string;
  content: string; // could be markdown or HTML for now
  createdAt: string;
  createdBy: string;
};

type SessionNote = {
  id: string;
  title: string;
  body: string;
  date: string;
  tags: string[];
  attachments: { id: string; name: string; url?: string }[];
  createdBy: string;
};

type ActionItem = {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
};

type OrgWorkspace = {
  orgId: string;
  strategicPlans: StrategicPlanVersion[];
  sessionNotes: SessionNote[];
  actionItems: ActionItem[];
};

const storageKey = (orgId: string) => `huddle_org_workspace_${orgId}`;

export const getWorkspace = async (orgId: string): Promise<OrgWorkspace> => {
  const raw = localStorage.getItem(storageKey(orgId));
  if (raw) return JSON.parse(raw) as OrgWorkspace;
  const initial: OrgWorkspace = { orgId, strategicPlans: [], sessionNotes: [], actionItems: [] };
  localStorage.setItem(storageKey(orgId), JSON.stringify(initial));
  return initial;
};

export const saveWorkspace = async (workspace: OrgWorkspace): Promise<void> => {
  localStorage.setItem(storageKey(workspace.orgId), JSON.stringify(workspace));
};

export const addStrategicPlanVersion = async (orgId: string, content: string, createdBy = 'Huddle Co.'): Promise<StrategicPlanVersion> => {
  const ws = await getWorkspace(orgId);
  const version: StrategicPlanVersion = { id: `sp-${Date.now()}`, content, createdAt: new Date().toISOString(), createdBy };
  ws.strategicPlans.push(version);
  await saveWorkspace(ws);
  return version;
};

export const listStrategicPlans = async (orgId: string): Promise<StrategicPlanVersion[]> => {
  const ws = await getWorkspace(orgId);
  return ws.strategicPlans.slice().sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt));
};

export const deleteStrategicPlanVersion = async (orgId: string, versionId: string) => {
  const ws = await getWorkspace(orgId);
  ws.strategicPlans = ws.strategicPlans.filter(v => v.id !== versionId);
  await saveWorkspace(ws);
};

export const getStrategicPlanVersion = async (orgId: string, versionId: string) => {
  const ws = await getWorkspace(orgId);
  return ws.strategicPlans.find(v => v.id === versionId) || null;
};

export const addSessionNote = async (orgId: string, note: Omit<SessionNote,'id'|'createdBy'>, createdBy = 'Huddle Co.') => {
  const ws = await getWorkspace(orgId);
  const n: SessionNote = { id: `note-${Date.now()}`, createdBy, ...note } as SessionNote;
  ws.sessionNotes.push(n);
  await saveWorkspace(ws);
  return n;
};

export const listSessionNotes = async (orgId: string) => {
  const ws = await getWorkspace(orgId);
  return ws.sessionNotes.slice().sort((a,b) => +new Date(b.date) - +new Date(a.date));
};

export const addActionItem = async (orgId: string, item: Omit<ActionItem,'id'>) => {
  const ws = await getWorkspace(orgId);
  const ai: ActionItem = { id: `action-${Date.now()}`, ...item } as ActionItem;
  ws.actionItems.push(ai);
  await saveWorkspace(ws);
  return ai;
};

export const updateActionItem = async (orgId: string, item: ActionItem) => {
  const ws = await getWorkspace(orgId);
  ws.actionItems = ws.actionItems.map(i => i.id === item.id ? item : i);
  await saveWorkspace(ws);
  return item;
};

export const listActionItems = async (orgId: string) => {
  const ws = await getWorkspace(orgId);
  return ws.actionItems.slice().sort((a,b) => {
    const order = { 'Not Started': 0, 'In Progress': 1, 'Completed': 2 } as Record<string, number>;
    return order[a.status] - order[b.status];
  });
};

export default {
  getWorkspace,
  saveWorkspace,
  addStrategicPlanVersion,
  listStrategicPlans,
  addSessionNote,
  listSessionNotes,
  addActionItem,
  listActionItems,
  updateActionItem
};
