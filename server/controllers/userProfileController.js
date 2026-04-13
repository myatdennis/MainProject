import { sendError, sendOk } from '../lib/apiEnvelope.js';
import { mapUserProfileResponse, normalizeUserProfileUpdatePayload } from '../services/userProfileService.js';

export const createUserProfileController = ({ supabase, ensureSupabase, requireUserContext }) => {
  const getCurrentUserProfile = async (req, res) => {
    if (!ensureSupabase(res)) return;
    const context = requireUserContext(req, res);
    if (!context) return;

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', context.userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const userRow = null;
      let organizationRow = null;
      const orgId = profileRow?.organization_id || userRow?.organization_id || userRow?.organizationId;
      if (orgId) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, status')
          .eq('id', orgId)
          .maybeSingle();
        if (orgError) throw orgError;
        organizationRow = orgData;
      }

      return sendOk(res, mapUserProfileResponse(profileRow, userRow, organizationRow));
    } catch (error) {
      console.error('Failed to load current user profile:', error);
      return sendError(res, 500, 'profile_load_failed', 'Unable to load profile');
    }
  };

  const updateCurrentUserProfile = async (req, res) => {
    if (!ensureSupabase(res)) return;
    const context = requireUserContext(req, res);
    if (!context) return;

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', context.userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const userRow = null;
      const allowOrgChange = context.userRole === 'admin';
      const profilePayload = normalizeUserProfileUpdatePayload(context.userId, req.body || {}, { allowOrgChange });

      if (!profilePayload) {
        return sendError(res, 400, 'no_profile_fields', 'No profile fields provided');
      }

      if (existingProfile?.id) {
        profilePayload.id = existingProfile.id;
      }

      const upsertResult = await supabase
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select('*');

      if (upsertResult.error) throw upsertResult.error;
      const upsertedProfile = Array.isArray(upsertResult.data) ? upsertResult.data[0] : upsertResult.data;
      if (!upsertedProfile) throw new Error('profile_upsert_no_rows');

      let organizationRow = null;
      const orgId = upsertedProfile.organization_id || userRow?.organization_id || userRow?.organizationId;
      if (orgId) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, status')
          .eq('id', orgId)
          .maybeSingle();
        if (orgError) throw orgError;
        organizationRow = orgData;
      }

      return sendOk(res, mapUserProfileResponse(upsertedProfile, userRow, organizationRow));
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return sendError(res, 500, 'profile_update_failed', 'Unable to update profile');
    }
  };

  return {
    getCurrentUserProfile,
    updateCurrentUserProfile,
  };
};
