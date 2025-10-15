export type Org = {
  id: string;
  name: string;
  type: string;
  description?: string;
  logo?: string;
  
  // Contact Information
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  
  // Address Information
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  // Subscription & Billing
  subscription: string;
  billingEmail?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'annually';
  customPricing?: number;
  
  // Capacity & Limits
  maxLearners?: number;
  maxCourses?: number;
  maxStorage?: number; // in GB
  
  // Features & Permissions
  features?: {
    analytics: boolean;
    certificates: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    sso: boolean;
    mobileApp: boolean;
    reporting: boolean;
    integrations: boolean;
  };
  
  // Settings
  settings?: {
    autoEnrollment: boolean;
    emailNotifications: boolean;
    progressTracking: boolean;
    allowDownloads: boolean;
    requireCompletion: boolean;
    dataRetention: number; // in months
  };
  
  // Status & Metadata
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  enrollmentDate?: string;
  contractStart?: string;
  contractEnd?: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Usage Statistics
  totalLearners: number;
  activeLearners: number;
  completionRate: number;
  cohorts: string[];
  lastActivity?: string;
  modules: Record<string, number>;
  
  // Additional Data
  notes?: string;
  tags?: string[];
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
  const now = new Date().toISOString();
  
  const newOrg: Org = {
    id,
    name: payload.name || 'New Organization',
    type: payload.type || 'Organization',
    description: payload.description,
    logo: payload.logo,
    
    // Contact Information
    contactPerson: payload.contactPerson || 'Unknown',
    contactEmail: payload.contactEmail || '',
    contactPhone: payload.contactPhone,
    website: payload.website,
    
    // Address Information
    address: payload.address,
    city: payload.city,
    state: payload.state,
    country: payload.country || 'United States',
    postalCode: payload.postalCode,
    
    // Subscription & Billing
    subscription: payload.subscription || 'Standard',
    billingEmail: payload.billingEmail,
    billingCycle: payload.billingCycle || 'monthly',
    customPricing: payload.customPricing,
    
    // Capacity & Limits
    maxLearners: payload.maxLearners || 100,
    maxCourses: payload.maxCourses || 50,
    maxStorage: payload.maxStorage || 10,
    
    // Features & Permissions
    features: payload.features || {
      analytics: true,
      certificates: true,
      apiAccess: false,
      customBranding: false,
      sso: false,
      mobileApp: true,
      reporting: true,
      integrations: false,
    },
    
    // Settings
    settings: payload.settings || {
      autoEnrollment: false,
      emailNotifications: true,
      progressTracking: true,
      allowDownloads: true,
      requireCompletion: false,
      dataRetention: 24,
    },
    
    // Status & Metadata
    status: payload.status || 'active',
    enrollmentDate: payload.enrollmentDate || now,
    contractStart: payload.contractStart,
    contractEnd: payload.contractEnd,
    createdAt: now,
    updatedAt: now,
    
    // Usage Statistics
    totalLearners: payload.totalLearners || 0,
    activeLearners: payload.activeLearners || 0,
    completionRate: payload.completionRate || 0,
    cohorts: payload.cohorts || [],
    lastActivity: payload.lastActivity,
    modules: payload.modules || {},
    
    // Additional Data
    notes: payload.notes || '',
    tags: payload.tags || [],
  };
  
  all.push(newOrg);
  write(all);
  return newOrg;
};

// Add new functions for comprehensive org management
export const deleteOrg = async (id: string): Promise<void> => {
  const all = read();
  const filtered = all.filter(org => org.id !== id);
  write(filtered);
};

export const bulkUpdateOrgs = async (updates: Array<{id: string, data: Partial<Org>}>): Promise<Org[]> => {
  const all = read();
  const updatedOrgs: Org[] = [];
  
  updates.forEach(update => {
    const idx = all.findIndex(org => org.id === update.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...update.data, updatedAt: new Date().toISOString() };
      updatedOrgs.push(all[idx]);
    }
  });
  
  write(all);
  return updatedOrgs;
};

export const getOrgStats = async (id: string): Promise<any> => {
  const org = await getOrg(id);
  if (!org) return null;
  
  // Mock advanced statistics
  return {
    overview: {
      totalUsers: org.totalLearners,
      activeUsers: org.activeLearners,
      completionRate: org.completionRate,
      avgSessionTime: Math.floor(Math.random() * 30) + 15, // 15-45 minutes
    },
    engagement: {
      dailyActiveUsers: Math.floor(org.activeLearners * 0.6),
      weeklyActiveUsers: Math.floor(org.activeLearners * 0.8),
      monthlyActiveUsers: org.activeLearners,
    },
    performance: {
      coursesCompleted: Object.values(org.modules).reduce((sum, val) => sum + Math.floor(val * 0.8), 0),
      certificatesIssued: Math.floor(org.totalLearners * (org.completionRate / 100)),
      avgScores: Object.fromEntries(
        Object.keys(org.modules).map(key => [key, Math.floor(Math.random() * 30) + 70])
      ),
    },
    trends: {
      userGrowth: Array.from({ length: 12 }, (_, i) => ({
        month: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        users: Math.floor(Math.random() * 10) + org.totalLearners * 0.8,
      })),
      completionTrends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        completions: Math.floor(Math.random() * 5) + 2,
      })),
    }
  };
};

export default { 
  listOrgs, 
  getOrg, 
  updateOrg, 
  createOrg, 
  deleteOrg, 
  bulkUpdateOrgs, 
  getOrgStats 
};
