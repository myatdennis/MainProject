// Temporary DAL facade delegating to the existing in-memory ProfileService.
// This keeps UI layers off src/services/* while we gradually move storage/API.
import type { UserProfile, OrganizationProfile, BaseResource, ResourceFilter, ResourceSendRequest } from '../models/Profile';
import type { OrgProfileContext } from '../services/orgProfileService';
import profileService, {
  getUserProfile as _getUserProfile,
  getOrganizationProfile as _getOrganizationProfile,
  getOrganizationProfileContext as _getOrganizationProfileContext,
  updateResourceStatus as _updateResourceStatus,
} from '../services/ProfileService';

export type { UserProfile, OrganizationProfile, BaseResource, ResourceFilter, ResourceSendRequest, OrgProfileContext };

export const listUserProfiles = (filter?: { organizationId?: string; search?: string }): Promise<UserProfile[]> =>
  profileService.listUserProfiles(filter);

export const listOrganizationProfiles = (filter?: { search?: string; status?: string }): Promise<OrganizationProfile[]> =>
  profileService.listOrganizationProfiles(filter);

export const addResourceToProfile = (request: ResourceSendRequest): Promise<BaseResource> =>
  profileService.addResourceToProfile(request);

export const getProfileResources = (
  profileType: 'user' | 'organization',
  profileId: string,
  filter?: ResourceFilter,
): Promise<BaseResource[]> => profileService.getProfileResources(profileType, profileId, filter);

export const getUserProfile = (id: string): Promise<UserProfile | null> => _getUserProfile(id);
export const getOrganizationProfile = (id: string): Promise<OrganizationProfile | null> => _getOrganizationProfile(id);
export const getOrganizationProfileContext = (orgId: string): Promise<OrgProfileContext> =>
  _getOrganizationProfileContext(orgId);
export const updateResourceStatus = (
  profileType: 'user' | 'organization',
  profileId: string,
  resourceId: string,
  status: BaseResource['status'],
): Promise<boolean> => _updateResourceStatus(profileType, profileId, resourceId, status);

export default {
  listUserProfiles,
  listOrganizationProfiles,
  addResourceToProfile,
  getProfileResources,
  getUserProfile,
  getOrganizationProfile,
  getOrganizationProfileContext,
  updateResourceStatus,
};
