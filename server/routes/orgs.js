// Organization routes extracted from server/index.js
// Modularize all /api/orgs endpoints here
import express from 'express';

const router = express.Router();


// POST /api/orgs/:orgId/memberships/accept
router.post('/:orgId/memberships/accept', async (req, res) => {
  const { supabase, ensureSupabase, requireUserContext, invalidateMembershipCache, buildMembershipSelect, getOrgInvitesOrganizationColumnName, buildActorFromRequest, recordActivationEvent, markActivationStep } = req.app.locals;
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const now = new Date().toISOString();

    const { error: deactivateOthersError } = await supabase
      .from('organization_memberships')
      .update({ status: 'inactive', is_active: false, last_seen_at: now })
      .eq('user_id', context.userId)
      .neq('organization_id', orgId)
      .eq('is_active', true);
    if (deactivateOthersError) throw deactivateOthersError;

    const { data, error } = await supabase
      .from('organization_memberships')
      .update({ status: 'active', is_active: true, accepted_at: now, last_seen_at: now })
      .eq('organization_id', orgId)
      .eq('user_id', context.userId)
      .select(buildMembershipSelect('id', 'organization_id', 'user_id', 'role', 'status', 'accepted_at', 'last_seen_at'))
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (req.user?.email) {
      try {
        const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
        await supabase
          .from('org_invites')
          .update({ status: 'accepted' })
          .eq(inviteOrgColumn, orgId)
          .eq('email', req.user.email.toLowerCase())
          .in('status', ['pending', 'sent']);
      } catch (inviteError) {
        console.warn('[onboarding] Failed to sync invite acceptance', inviteError);
      }
      const inviteOrgColumn = await getOrgInvitesOrganizationColumnName();
      const { count } = await supabase
        .from('org_invites')
        .select('id', { count: 'exact', head: true })
        .eq(inviteOrgColumn, orgId)
        .in('status', ['pending', 'sent']);
      const actor = buildActorFromRequest(req);
      await recordActivationEvent(orgId, 'invite_accepted', { membershipId: data.id }, actor);
      if (!count || count === 0) {
        await markActivationStep(orgId, 'invite_team', { status: 'completed', actor });
      }
    }

    // Invalidate so the newly-active membership is visible immediately.
    try { invalidateMembershipCache(context.userId, { orgId }); } catch (_) {}

    res.json({ data });
  } catch (error) {
    console.error(`Failed to accept membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to accept membership' });
  }
});

// POST /api/orgs/:orgId/memberships/leave
router.post('/:orgId/memberships/leave', async (req, res) => {
  const { supabase, ensureSupabase, requireUserContext, invalidateMembershipCache } = req.app.locals;
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const { data: membership, error } = await supabase
      .from('organization_memberships')
      .select('id, role, status')
      .eq('organization_id', orgId)
      .eq('user_id', context.userId)
      .maybeSingle();

    if (error) throw error;
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (membership.role === 'owner') {
      const { count, error: countError } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('role', 'owner')
        .eq('status', 'active');

      if (countError) throw countError;
      if (!count || count <= 1) {
        res.status(400).json({ error: 'Cannot leave as the last active owner' });
        return;
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('organization_memberships')
      .update({ status: 'revoked', is_active: false, last_seen_at: now })
      .eq('organization_id', orgId)
      .eq('user_id', context.userId);

    if (updateError) throw updateError;

    // Invalidate so the revoked membership is no longer served from cache.
    try { invalidateMembershipCache(context.userId, { orgId }); } catch (_) {}

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to leave organization ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to leave organization' });
  }
});

export default router;
