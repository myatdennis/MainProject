// Mock profile service for managing user and organization profiles with resources
import { UserProfile, OrganizationProfile, BaseResource, ResourceFilter, ResourceSendRequest } from '../models/Profile';
import orgService from './orgService';
import notificationService from './notificationService';

const USER_PROFILES_KEY = 'huddle_user_profiles_v1';
const ORG_PROFILES_KEY = 'huddle_org_profiles_v1';

// Seed data for user profiles
const seedUserProfiles = (): UserProfile[] => [
  {
    id: 'user-1',
    userId: '1',
    name: 'Sarah Chen',
    email: 'sarah.chen@pacificcoast.edu',
    role: 'VP Student Affairs',
    organization: 'Pacific Coast University',
    organizationId: '1',
    enrollmentDate: '2025-01-15',
    lastActivity: '2025-03-10',
    bio: 'Passionate about student success and inclusive leadership development.',
    avatar: 'https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=100',
    contactInfo: {
      phone: '+1 (555) 123-4567',
      department: 'Student Affairs',
      title: 'Vice President'
    },
    learningProgress: {
      completedModules: 3,
      totalModules: 5,
      completionRate: 85,
      modules: { foundations: 100, bias: 100, empathy: 100, conversations: 75, planning: 50 }
    },
    preferences: {
      notifications: true,
      emailUpdates: true,
      language: 'en'
    },
    resources: [
      {
        id: 'res-1',
        type: 'document',
        title: 'Leadership Best Practices',
        description: 'Comprehensive guide for effective leadership',
        documentId: 'doc-123',
        createdAt: '2025-03-01T10:00:00Z',
        createdBy: 'Admin',
        tags: ['leadership', 'best-practices'],
        category: 'Training',
        priority: 'high',
        status: 'read'
      }
    ],
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-03-10T14:30:00Z'
  },
  {
    id: 'user-2',
    userId: '5',
    name: 'Lisa Park',
    email: 'lpark@techforward.com',
    role: 'Chief HR Officer',
    organization: 'TechForward Solutions',
    organizationId: '5',
    enrollmentDate: '2025-02-01',
    lastActivity: '2025-03-11',
    bio: 'Driving inclusive culture transformation in tech organizations.',
    avatar: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=100',
    contactInfo: {
      phone: '+1 (555) 987-6543',
      department: 'Human Resources',
      title: 'Chief HR Officer'
    },
    learningProgress: {
      completedModules: 4,
      totalModules: 5,
      completionRate: 96,
      modules: { foundations: 100, bias: 100, empathy: 100, conversations: 100, planning: 80 }
    },
    preferences: {
      notifications: true,
      emailUpdates: true,
      language: 'en'
    },
    resources: [],
    createdAt: '2025-02-01T08:00:00Z',
    updatedAt: '2025-03-11T16:45:00Z'
  }
];

// Seed data for organization profiles - sync with existing org data
const seedOrgProfiles = (): OrganizationProfile[] => {
  try {
    // Try to get existing orgs from orgService to create profiles
    const existingOrgs = localStorage.getItem('huddle_orgs_v1');
    if (existingOrgs) {
      const orgs = JSON.parse(existingOrgs);
      return orgs.map((org: any) => ({
        id: `org-profile-${org.id}`,
        orgId: org.id,
        name: org.name,
        type: org.type,
        contactPerson: org.contactPerson,
        contactEmail: org.contactEmail,
        description: `${org.type} organization committed to inclusive leadership development.`,
        enrollmentDate: org.enrollmentDate,
        status: org.status as 'active' | 'inactive' | 'pending',
        subscription: org.subscription,
        lastActivity: org.lastActivity,
        metrics: {
          totalLearners: org.totalLearners,
          activeLearners: org.activeLearners,
          completionRate: org.completionRate,
          totalDownloads: Math.floor(Math.random() * 200) + 50 // Mock download count
        },
        cohorts: org.cohorts || [],
        modules: org.modules || {},
        notes: org.notes,
        resources: org.id === '1' ? [
          {
            id: 'org-res-1',
            type: 'document',
            title: 'University Leadership Framework',
            description: 'Customized leadership framework for university settings',
            documentId: 'doc-456',
            createdAt: '2025-02-15T09:00:00Z',
            createdBy: 'Admin',
            tags: ['university', 'framework', 'leadership'],
            category: 'Framework',
            priority: 'high' as const,
            status: 'unread' as const
          }
        ] : [],
        createdAt: org.enrollmentDate || '2025-01-01T08:00:00Z',
        updatedAt: org.lastActivity || new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error('Failed to sync org profiles with existing orgs:', error);
  }

  // Fallback to hardcoded seed data
  return [
    {
      id: 'org-profile-1',
      orgId: '1',
      name: 'Pacific Coast University',
      type: 'University',
      contactPerson: 'Dr. Sarah Chen',
      contactEmail: 'sarah.chen@pacificcoast.edu',
      description: 'Leading public university committed to inclusive excellence and student success.',
      website: 'https://pacificcoast.edu',
      logo: 'https://via.placeholder.com/120x120?text=PCU',
      address: {
        street: '123 University Ave',
        city: 'San Francisco',
        state: 'CA',
        zip: '94122',
        country: 'USA'
      },
      enrollmentDate: '2025-01-15',
      status: 'active',
      subscription: 'Premium',
      lastActivity: '2025-03-11',
      metrics: {
        totalLearners: 45,
        activeLearners: 42,
        completionRate: 94,
        totalDownloads: 127
      },
      cohorts: ['Spring 2025 Leadership', 'Faculty Development 2025'],
      modules: { foundations: 98, bias: 91, empathy: 87, conversations: 82, planning: 76 },
      notes: 'Excellent engagement. Requested additional modules for faculty.',
      resources: [
        {
          id: 'org-res-1',
          type: 'document',
          title: 'University Leadership Framework',
          description: 'Customized leadership framework for university settings',
          documentId: 'doc-456',
          createdAt: '2025-02-15T09:00:00Z',
          createdBy: 'Admin',
          tags: ['university', 'framework', 'leadership'],
          category: 'Framework',
          priority: 'high',
          status: 'unread'
        }
      ],
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-03-11T12:00:00Z'
    }
  ];
};

// Storage helpers
const readUserProfiles = (): UserProfile[] => {
  try {
    const raw = localStorage.getItem(USER_PROFILES_KEY);
    if (!raw) return seedUserProfiles();
    return JSON.parse(raw) as UserProfile[];
  } catch {
    return seedUserProfiles();
  }
};

const writeUserProfiles = (profiles: UserProfile[]) => 
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));

const readOrgProfiles = (): OrganizationProfile[] => {
  try {
    const raw = localStorage.getItem(ORG_PROFILES_KEY);
    if (!raw) return seedOrgProfiles();
    return JSON.parse(raw) as OrganizationProfile[];
  } catch {
    return seedOrgProfiles();
  }
};

const writeOrgProfiles = (profiles: OrganizationProfile[]) => 
  localStorage.setItem(ORG_PROFILES_KEY, JSON.stringify(profiles));

// User Profile CRUD operations
export const listUserProfiles = async (filter?: { organizationId?: string; search?: string }): Promise<UserProfile[]> => {
  let profiles = readUserProfiles();
  
  if (filter?.organizationId) {
    profiles = profiles.filter(p => p.organizationId === filter.organizationId);
  }
  
  if (filter?.search) {
    const searchTerm = filter.search.toLowerCase();
    profiles = profiles.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.email.toLowerCase().includes(searchTerm) ||
      p.organization?.toLowerCase().includes(searchTerm) ||
      p.role?.toLowerCase().includes(searchTerm)
    );
  }
  
  return profiles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getUserProfile = async (id: string): Promise<UserProfile | null> => {
  const profiles = readUserProfiles();
  return profiles.find(p => p.id === id) || null;
};

export const createUserProfile = async (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> => {
  const profiles = readUserProfiles();
  const newProfile: UserProfile = {
    ...profile,
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  profiles.push(newProfile);
  writeUserProfiles(profiles);
  return newProfile;
};

export const updateUserProfile = async (id: string, updates: Partial<UserProfile>): Promise<UserProfile> => {
  const profiles = readUserProfiles();
  const index = profiles.findIndex(p => p.id === id);
  
  if (index === -1) {
    throw new Error('User profile not found');
  }
  
  profiles[index] = {
    ...profiles[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  writeUserProfiles(profiles);
  return profiles[index];
};

export const deleteUserProfile = async (id: string): Promise<boolean> => {
  const profiles = readUserProfiles();
  const index = profiles.findIndex(p => p.id === id);
  
  if (index === -1) {
    return false;
  }
  
  profiles.splice(index, 1);
  writeUserProfiles(profiles);
  return true;
};

// Organization Profile CRUD operations
export const listOrganizationProfiles = async (filter?: { search?: string; status?: string }): Promise<OrganizationProfile[]> => {
  let profiles = readOrgProfiles();
  
  if (filter?.status) {
    profiles = profiles.filter(p => p.status === filter.status);
  }
  
  if (filter?.search) {
    const searchTerm = filter.search.toLowerCase();
    profiles = profiles.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.type.toLowerCase().includes(searchTerm) ||
      p.contactPerson.toLowerCase().includes(searchTerm) ||
      p.contactEmail?.toLowerCase().includes(searchTerm)
    );
  }
  
  return profiles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getOrganizationProfile = async (id: string): Promise<OrganizationProfile | null> => {
  const profiles = readOrgProfiles();
  return profiles.find(p => p.id === id) || null;
};

export const getOrganizationProfileByOrgId = async (orgId: string): Promise<OrganizationProfile | null> => {
  const profiles = readOrgProfiles();
  return profiles.find(p => p.orgId === orgId) || null;
};

export const createOrganizationProfile = async (profile: Omit<OrganizationProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrganizationProfile> => {
  const profiles = readOrgProfiles();
  const newProfile: OrganizationProfile = {
    ...profile,
    id: `org-profile-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  profiles.push(newProfile);
  writeOrgProfiles(profiles);
  return newProfile;
};

export const updateOrganizationProfile = async (id: string, updates: Partial<OrganizationProfile>): Promise<OrganizationProfile> => {
  const profiles = readOrgProfiles();
  const index = profiles.findIndex(p => p.id === id);
  
  if (index === -1) {
    throw new Error('Organization profile not found');
  }
  
  profiles[index] = {
    ...profiles[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  writeOrgProfiles(profiles);
  return profiles[index];
};

export const deleteOrganizationProfile = async (id: string): Promise<boolean> => {
  const profiles = readOrgProfiles();
  const index = profiles.findIndex(p => p.id === id);
  
  if (index === -1) {
    return false;
  }
  
  profiles.splice(index, 1);
  writeOrgProfiles(profiles);
  return true;
};

// Resource management
export const addResourceToProfile = async (request: ResourceSendRequest): Promise<BaseResource> => {
  const resource: BaseResource = {
    ...request.resource,
    id: `res-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: 'Admin',
    status: 'unread'
  };
  
  if (request.profileType === 'user') {
    const profiles = readUserProfiles();
    const index = profiles.findIndex(p => p.id === request.profileId);
    
    if (index === -1) {
      throw new Error('User profile not found');
    }
    
    profiles[index].resources.push(resource);
    profiles[index].updatedAt = new Date().toISOString();
    writeUserProfiles(profiles);
    
    // Send notification if requested
    if (request.notifyRecipient) {
      try {
        await notificationService.addNotification({
          title: `New ${resource.type}: ${resource.title}`,
          body: request.message || `You have received a new ${resource.type}`,
          userId: profiles[index].userId
        });
      } catch (error) {
        console.warn('Failed to send notification:', error);
      }
    }
  } else {
    const profiles = readOrgProfiles();
    const index = profiles.findIndex(p => p.id === request.profileId);
    
    if (index === -1) {
      throw new Error('Organization profile not found');
    }
    
    profiles[index].resources.push(resource);
    profiles[index].updatedAt = new Date().toISOString();
    writeOrgProfiles(profiles);
    
    // Send notification if requested
    if (request.notifyRecipient) {
      try {
        await notificationService.addNotification({
          title: `New ${resource.type}: ${resource.title}`,
          body: request.message || `Your organization has received a new ${resource.type}`,
          orgId: profiles[index].orgId
        });
      } catch (error) {
        console.warn('Failed to send notification:', error);
      }
    }
  }
  
  return resource;
};

export const updateResourceStatus = async (profileType: 'user' | 'organization', profileId: string, resourceId: string, status: BaseResource['status']): Promise<boolean> => {
  if (profileType === 'user') {
    const profiles = readUserProfiles();
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    
    if (profileIndex === -1) return false;
    
    const resourceIndex = profiles[profileIndex].resources.findIndex(r => r.id === resourceId);
    if (resourceIndex === -1) return false;
    
    profiles[profileIndex].resources[resourceIndex].status = status;
    profiles[profileIndex].updatedAt = new Date().toISOString();
    writeUserProfiles(profiles);
  } else {
    const profiles = readOrgProfiles();
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    
    if (profileIndex === -1) return false;
    
    const resourceIndex = profiles[profileIndex].resources.findIndex(r => r.id === resourceId);
    if (resourceIndex === -1) return false;
    
    profiles[profileIndex].resources[resourceIndex].status = status;
    profiles[profileIndex].updatedAt = new Date().toISOString();
    writeOrgProfiles(profiles);
  }
  
  return true;
};

export const getProfileResources = async (profileType: 'user' | 'organization', profileId: string, filter?: ResourceFilter): Promise<BaseResource[]> => {
  let resources: BaseResource[] = [];
  
  if (profileType === 'user') {
    const profile = await getUserProfile(profileId);
    if (!profile) return [];
    resources = profile.resources;
  } else {
    const profile = await getOrganizationProfile(profileId);
    if (!profile) return [];
    resources = profile.resources;
  }
  
  // Apply filters
  if (filter) {
    if (filter.type) resources = resources.filter(r => r.type === filter.type);
    if (filter.category) resources = resources.filter(r => r.category === filter.category);
    if (filter.priority) resources = resources.filter(r => r.priority === filter.priority);
    if (filter.status) resources = resources.filter(r => r.status === filter.status);
    if (filter.tag) resources = resources.filter(r => r.tags.includes(filter.tag));
    if (filter.createdBy) resources = resources.filter(r => r.createdBy === filter.createdBy);
    if (filter.dateFrom) resources = resources.filter(r => new Date(r.createdAt) >= new Date(filter.dateFrom!));
    if (filter.dateTo) resources = resources.filter(r => new Date(r.createdAt) <= new Date(filter.dateTo!));
  }
  
  return resources.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Export default service object
export default {
  // User profiles
  listUserProfiles,
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile,
  
  // Organization profiles
  listOrganizationProfiles,
  getOrganizationProfile,
  getOrganizationProfileByOrgId,
  createOrganizationProfile,
  updateOrganizationProfile,
  deleteOrganizationProfile,
  
  // Resources
  addResourceToProfile,
  updateResourceStatus,
  getProfileResources
};