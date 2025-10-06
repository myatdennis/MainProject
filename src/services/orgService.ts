export type Org = {
  id: string;
  name: string;
  type: string;
  contactPerson: string;
  contactEmail?: string;
  enrollmentDate?: string;
  status: string;
  totalLearners: number;
  activeLearners: number;
  completionRate: number;
  cohorts: string[];
  subscription?: string;
  lastActivity?: string;
  modules: Record<string, number>;
  notes?: string;
};

const STORAGE_KEY = 'huddle_orgs_v1';

const seedOrgs = (): Org[] => ([
  {
    id: '1',
    name: 'Pacific Coast University',
    type: 'University',
    contactPerson: 'Dr. Sarah Chen',
    contactEmail: 'sarah.chen@pacificcoast.edu',
    enrollmentDate: '2025-01-15',
    status: 'active',
    totalLearners: 45,
    activeLearners: 42,
    completionRate: 94,
    cohorts: ['Spring 2025 Leadership', 'Faculty Development 2025'],
    subscription: 'Premium',
    lastActivity: '2025-03-11',
    modules: { foundations: 98, bias: 91, empathy: 87, conversations: 82, planning: 76 },
    notes: 'Excellent engagement. Requested additional modules for faculty.'
  },
  {
    id: '2',
    name: 'Mountain View High School',
    type: 'K-12 Education',
    contactPerson: 'Marcus Rodriguez',
    contactEmail: 'mrodriguez@mvhs.edu',
    enrollmentDate: '2025-01-20',
    status: 'active',
    totalLearners: 23,
    activeLearners: 20,
    completionRate: 87,
    cohorts: ['Spring 2025 Leadership'],
    subscription: 'Standard',
    lastActivity: '2025-03-10',
    modules: { foundations: 95, bias: 89, empathy: 85, conversations: 78, planning: 65 },
    notes: 'Focus on athletic department leadership development.'
  },
  {
    id: '3',
    name: 'Community Impact Network',
    type: 'Nonprofit',
    contactPerson: 'Jennifer Walsh',
    contactEmail: 'jwalsh@communityimpact.org',
    enrollmentDate: '2025-01-10',
    status: 'inactive',
    totalLearners: 28,
    activeLearners: 15,
    completionRate: 61,
    cohorts: ['Spring 2025 Leadership'],
    subscription: 'Standard',
    lastActivity: '2025-02-28',
    modules: { foundations: 85, bias: 68, empathy: 54, conversations: 42, planning: 28 },
    notes: 'Low engagement recently. Follow up needed.'
  },
  {
    id: '4',
    name: 'Regional Fire Department',
    type: 'Government',
    contactPerson: 'Captain David Thompson',
    contactEmail: 'dthompson@regionalfire.gov',
    enrollmentDate: '2024-12-01',
    status: 'active',
    totalLearners: 67,
    activeLearners: 63,
    completionRate: 89,
    cohorts: ['Winter 2025 Leadership', 'Command Staff Development'],
    subscription: 'Premium',
    lastActivity: '2025-03-11',
    modules: { foundations: 92, bias: 88, empathy: 91, conversations: 85, planning: 79 },
    notes: 'Strong leadership commitment. Excellent results.'
  },
  {
    id: '5',
    name: 'TechForward Solutions',
    type: 'Corporate',
    contactPerson: 'Lisa Park',
    contactEmail: 'lpark@techforward.com',
    enrollmentDate: '2025-02-01',
    status: 'active',
    totalLearners: 34,
    activeLearners: 32,
    completionRate: 96,
    cohorts: ['Spring 2025 Leadership'],
    subscription: 'Premium',
    lastActivity: '2025-03-11',
    modules: { foundations: 100, bias: 97, empathy: 94, conversations: 91, planning: 88 },
    notes: 'Outstanding engagement. Interested in advanced modules.'
  }
]);

const read = (): Org[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedOrgs();
    return JSON.parse(raw) as Org[];
  } catch {
    return seedOrgs();
  }
};

const write = (items: Org[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

export const listOrgs = async (): Promise<Org[]> => {
  return read();
};

export const getOrg = async (id: string): Promise<Org | null> => {
  const all = read();
  return all.find(o => o.id === id) || null;
};

export const updateOrg = async (id: string, patch: Partial<Org>): Promise<Org> => {
  const all = read();
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) throw new Error('Org not found');
  all[idx] = { ...all[idx], ...patch };
  write(all);
  return all[idx];
};

export const createOrg = async (payload: Partial<Org>): Promise<Org> => {
  const all = read();
  const id = String(Date.now());
  const newOrg: Org = {
    id,
    name: payload.name || 'New Organization',
    type: payload.type || 'Organization',
    contactPerson: payload.contactPerson || 'Unknown',
    contactEmail: payload.contactEmail,
    enrollmentDate: new Date().toISOString(),
    status: payload.status || 'active',
    totalLearners: payload.totalLearners || 0,
    activeLearners: payload.activeLearners || 0,
    completionRate: payload.completionRate || 0,
    cohorts: payload.cohorts || [],
    subscription: payload.subscription || 'Standard',
    lastActivity: payload.lastActivity,
    modules: payload.modules || {},
    notes: payload.notes || '',
  };
  all.push(newOrg);
  write(all);
  return newOrg;
};

export default { listOrgs, getOrg, updateOrg, createOrg };
