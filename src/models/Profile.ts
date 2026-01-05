// Profile models for user and organization profiles with resource management
export interface BaseResource {
  id: string;
  type: 'note' | 'document' | 'link' | 'video' | 'assignment';
  title: string;
  description?: string;
  url?: string;
  content?: string; // for notes
  documentId?: string; // reference to document in documentService
  createdAt: string;
  createdBy: string; // admin who sent it
  tags: string[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'unread' | 'read' | 'completed';
}

export interface UserProfile {
  id: string;
  userId?: string; // reference to user from existing system
  name: string;
  email: string;
  role?: string;
  organization?: string;
  organizationId?: string;
  enrollmentDate?: string;
  lastActivity?: string;
  bio?: string;
  avatar?: string;
  contactInfo?: {
    phone?: string;
    department?: string;
    title?: string;
  };
  learningProgress?: {
    completedModules: number;
    totalModules: number;
    completionRate: number;
    modules: Record<string, number>;
  };
  preferences?: {
    notifications: boolean;
    emailUpdates: boolean;
    language?: string;
  };
  resources: BaseResource[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationProfileDetails {
  mission?: string | null;
  vision?: string | null;
  coreValues?: any[];
  deiPriorities?: any[];
  toneGuidelines?: string | null;
  accessibilityCommitments?: string | null;
  preferredLanguages?: string[];
  audienceSegments?: any[];
  aiContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastAiRefreshAt?: string | null;
}

export interface OrganizationBrandingProfile {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  typography?: Record<string, unknown>;
  media?: any[];
}

export interface OrganizationContactProfile {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role?: string | null;
  type?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OrganizationProfile {
  id: string;
  orgId?: string; // reference to org from orgService
  name: string;
  type: string;
  contactPerson: string;
  contactEmail?: string;
  description?: string;
  website?: string;
  logo?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  enrollmentDate?: string;
  status: 'active' | 'inactive' | 'pending';
  subscription?: string;
  lastActivity?: string;
  metrics?: {
    totalLearners: number;
    activeLearners: number;
    completionRate: number;
    totalDownloads: number;
  };
  cohorts: string[];
  modules: Record<string, number>;
  notes?: string;
  profileDetails?: OrganizationProfileDetails;
  branding?: OrganizationBrandingProfile;
  contacts?: OrganizationContactProfile[];
  aiContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  resources: BaseResource[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceFilter {
  type?: BaseResource['type'];
  category?: string;
  priority?: BaseResource['priority'];
  status?: BaseResource['status'];
  tag?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ResourceSendRequest {
  profileType: 'user' | 'organization';
  profileId: string;
  resource: Omit<BaseResource, 'id' | 'createdAt' | 'createdBy' | 'status'>;
  notifyRecipient?: boolean;
  message?: string;
}