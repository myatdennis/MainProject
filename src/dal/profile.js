import profileService, { getUserProfile as _getUserProfile, getOrganizationProfile as _getOrganizationProfile, updateResourceStatus as _updateResourceStatus, } from '../services/ProfileService';
export const listUserProfiles = (filter) => profileService.listUserProfiles(filter);
export const listOrganizationProfiles = (filter) => profileService.listOrganizationProfiles(filter);
export const addResourceToProfile = (request) => profileService.addResourceToProfile(request);
export const getProfileResources = (profileType, profileId, filter) => profileService.getProfileResources(profileType, profileId, filter);
export const getUserProfile = (id) => _getUserProfile(id);
export const getOrganizationProfile = (id) => _getOrganizationProfile(id);
export const updateResourceStatus = (profileType, profileId, resourceId, status) => _updateResourceStatus(profileType, profileId, resourceId, status);
export default {
    listUserProfiles,
    listOrganizationProfiles,
    addResourceToProfile,
    getProfileResources,
    getUserProfile,
    getOrganizationProfile,
    updateResourceStatus,
};
