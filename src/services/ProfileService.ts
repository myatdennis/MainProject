// Mock profile service for managing user and organization profiles with resources
import { UserProfile, OrganizationProfile, BaseResource, ResourceFilter, ResourceSendRequest } from '../models/Profile';
import {
  listOrgProfiles as listOrgProfilesApi,
  getOrgProfile as getOrgProfileApi,
  upsertOrgProfile as upsertOrgProfileApi,
  removeOrgProfile as removeOrgProfileApi,
  getOrgProfileContext as getOrgProfileContextApi,
  type OrgProfileBundle,
  type OrgProfileUpdatePayload,
  type OrgContact,
  type OrgProfileContext,
} from './orgProfileService';
import notificationService from './notificationService';

let userProfilesCache: UserProfile[] | null = null;
let orgProfilesCache: OrganizationProfile[] | null = null;

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
  if (!userProfilesCache) {
    userProfilesCache = seedUserProfiles();
  }
  return userProfilesCache;
};

const writeUserProfiles = (profiles: UserProfile[]) => {
  userProfilesCache = profiles;
};

const readOrgProfiles = (): OrganizationProfile[] => {
  if (!orgProfilesCache) {
    orgProfilesCache = seedOrgProfiles();
  }
  return orgProfilesCache;
};

const writeOrgProfiles = (profiles: OrganizationProfile[]) => {
  orgProfilesCache = profiles;
};

const findLegacyOrgProfile = (legacyProfiles: OrganizationProfile[] = [], orgId?: string | null) => {
  if (!orgId) return undefined;
  return legacyProfiles.find((profile) => profile.id === orgId || profile.orgId === orgId);
};

const attachLegacyResources = (profile: OrganizationProfile, legacyProfiles?: OrganizationProfile[]) => {
  const legacy = findLegacyOrgProfile(legacyProfiles, profile.orgId ?? profile.id);
  const resources = legacy?.resources?.length ? legacy.resources : profile.resources ?? [];
  return { ...profile, resources };
};

const toContactProfile = (contact: OrgContact) => ({
  id: contact.id,
  orgId: contact.orgId,
  name: contact.name,
  email: contact.email,
  role: contact.role ?? undefined,
  type: contact.type ?? undefined,
  phone: contact.phone ?? undefined,
  isPrimary: contact.isPrimary,
  notes: contact.notes ?? undefined,
  createdAt: contact.createdAt ?? undefined,
  updatedAt: contact.updatedAt ?? undefined,
});

const mapBundleToOrganizationProfile = (
  bundle: OrgProfileBundle,
  legacyProfiles?: OrganizationProfile[],
): OrganizationProfile => {
  const org = bundle.organization;
  const profileDetails = bundle.profile ?? { orgId: org.id };
  const branding = bundle.branding ?? { orgId: org.id };
  const contacts = Array.isArray(bundle.contacts) ? bundle.contacts : [];

  const metrics = {
    totalLearners: org.totalLearners ?? 0,
    activeLearners: org.activeLearners ?? 0,
    completionRate: org.completionRate ?? 0,
    totalDownloads: Object.values(org.modules ?? {}).reduce(
      (sum, value) => sum + Number(value ?? 0),
      0,
    ),
  };

  const address = org.address || org.city || org.state || org.postalCode || org.country
    ? {
        street: org.address,
        city: org.city,
        state: org.state,
        zip: org.postalCode,
        country: org.country,
      }
    : undefined;

  const organizationProfile: OrganizationProfile = {
    id: org.id,
    orgId: org.id,
    name: org.name,
    type: org.type ?? 'organization',
    contactPerson: org.contactPerson ?? '',
    contactEmail: org.contactEmail ?? undefined,
    description: org.description ?? profileDetails.mission ?? undefined,
    website: org.website ?? undefined,
    logo: branding.logoUrl ?? org.logo ?? undefined,
    address,
    enrollmentDate: org.enrollmentDate ?? undefined,
    status: (org.status as OrganizationProfile['status']) ?? 'active',
    subscription: org.subscription ?? undefined,
    lastActivity: org.lastActivity ?? undefined,
    metrics,
    cohorts: org.cohorts ?? [],
    modules: org.modules ?? {},
    notes: org.notes ?? undefined,
    profileDetails,
    branding: {
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? null,
      secondaryColor: branding.secondaryColor ?? null,
      accentColor: branding.accentColor ?? null,
      typography: branding.typography ?? {},
      media: branding.media ?? [],
    },
    contacts: contacts.map(toContactProfile),
    aiContext: profileDetails.aiContext ?? undefined,
    metadata: profileDetails.metadata ?? undefined,
    resources: [],
    createdAt: org.createdAt ?? new Date().toISOString(),
    updatedAt: org.updatedAt ?? new Date().toISOString(),
  };

  return attachLegacyResources(organizationProfile, legacyProfiles);
};

const upsertLegacyOrgProfile = (profile: OrganizationProfile, legacyProfiles?: OrganizationProfile[]) => {
  const buffer = legacyProfiles ? [...legacyProfiles] : readOrgProfiles();
  const index = buffer.findIndex((entry) => entry.id === profile.id || entry.orgId === profile.orgId);
  if (index >= 0) {
    buffer[index] = profile;
  } else {
    buffer.push(profile);
  }
  writeOrgProfiles(buffer);
  return buffer;
};

const removeLegacyOrgProfile = (orgId: string) => {
  const profiles = readOrgProfiles();
  const next = profiles.filter((entry) => entry.id !== orgId && entry.orgId !== orgId);
  writeOrgProfiles(next);
};

const buildOrgProfileUpdatePayload = (updates: Partial<OrganizationProfile>): OrgProfileUpdatePayload => {
  const payload: OrgProfileUpdatePayload = {};
  const profilePayload: Record<string, unknown> = {};
  const brandingPayload: Record<string, unknown> = {};

  if (updates.profileDetails) {
    Object.assign(profilePayload, updates.profileDetails);
  }

  if (updates.description !== undefined && profilePayload.mission === undefined) {
    profilePayload.mission = updates.description;
  }

  if (updates.notes !== undefined) {
    profilePayload.metadata = {
      ...(profilePayload.metadata as Record<string, unknown> | undefined),
      notes: updates.notes,
    };
  }

  if (updates.aiContext) {
    profilePayload.aiContext = updates.aiContext;
  }

  if (updates.metadata) {
    profilePayload.metadata = {
      ...(profilePayload.metadata as Record<string, unknown> | undefined),
      ...updates.metadata,
    };
  }

  if (updates.branding) {
    Object.assign(brandingPayload, updates.branding);
  }

  if (updates.logo !== undefined && brandingPayload.logoUrl === undefined) {
    brandingPayload.logoUrl = updates.logo;
  }

  if (Object.keys(profilePayload).length > 0) {
    payload.profile = profilePayload as OrgProfileUpdatePayload['profile'];
  }

  if (Object.keys(brandingPayload).length > 0) {
    payload.branding = brandingPayload as OrgProfileUpdatePayload['branding'];
  }

  return payload;
};

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

// Organization Profile CRUD operations (Supabase-backed)
export const listOrganizationProfiles = async (filter?: { search?: string; status?: string }): Promise<OrganizationProfile[]> => {
  const legacy = readOrgProfiles();
  try {
    const bundles = await listOrgProfilesApi(filter);
    const mapped = bundles.map((bundle) => mapBundleToOrganizationProfile(bundle, legacy));
    writeOrgProfiles(mapped);
    return mapped;
  } catch (error) {
    console.warn('[ProfileService] Falling back to cached organization profiles:', error);
    return legacy;
  }
};

export const getOrganizationProfile = async (id: string): Promise<OrganizationProfile | null> => {
  const legacy = readOrgProfiles();
  try {
    const bundle = await getOrgProfileApi(id);
    const mapped = mapBundleToOrganizationProfile(bundle, legacy);
    upsertLegacyOrgProfile(mapped, legacy);
    return mapped;
  } catch (error) {
    console.warn(`[ProfileService] Falling back to cached organization profile ${id}:`, error);
    return legacy.find(p => p.id === id || p.orgId === id) || null;
  }
};

export const getOrganizationProfileByOrgId = async (orgId: string): Promise<OrganizationProfile | null> =>
  getOrganizationProfile(orgId);

export const getOrganizationProfileContext = async (orgId: string): Promise<OrgProfileContext> =>
  getOrgProfileContextApi(orgId);

export const createOrganizationProfile = async (
  profile: Omit<OrganizationProfile, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<OrganizationProfile> => {
  const targetOrgId = profile.orgId;
  if (!targetOrgId) {
    throw new Error('orgId is required to create an organization profile');
  }
  return updateOrganizationProfile(targetOrgId, profile);
};

export const updateOrganizationProfile = async (
  id: string,
  updates: Partial<OrganizationProfile>,
): Promise<OrganizationProfile> => {
  const payload = buildOrgProfileUpdatePayload(updates);
  if (!payload.profile && !payload.branding) {
    const existing = await getOrganizationProfile(id);
    if (!existing) throw new Error('Organization profile not found');
    return existing;
  }

  const legacy = readOrgProfiles();
  const bundle = await upsertOrgProfileApi(id, payload);
  const mapped = mapBundleToOrganizationProfile(bundle, legacy);
  upsertLegacyOrgProfile(mapped, legacy);
  return mapped;
};

export const deleteOrganizationProfile = async (id: string): Promise<boolean> => {
  try {
    await removeOrgProfileApi(id);
  } catch (error) {
    console.error(`[ProfileService] Failed to delete organization profile ${id}:`, error);
    return false;
  }

  removeLegacyOrgProfile(id);
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
          organizationId: profiles[index].orgId
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
    if (filter.tag) {
      const tag = filter.tag;
      resources = resources.filter(r => r.tags.includes(tag));
    }
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
  getOrganizationProfileContext,
  createOrganizationProfile,
  updateOrganizationProfile,
  deleteOrganizationProfile,
  
  // Resources
  addResourceToProfile,
  updateResourceStatus,
  getProfileResources
};