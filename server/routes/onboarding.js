// Onboarding and invite-related organization endpoints extracted from server/index.js
import express from 'express';

const router = express.Router();


// POST /api/admin/onboarding/orgs
router.post('/orgs', async (req, res) => {
	const { supabase, ensureSupabase, requireUserContext, buildActorFromRequest, initializeActivationSteps, recordActivationEvent, createAuditLogEntry, normalizeOrgRole, upsertOrganizationMembership, markActivationStep, createOrgInvite, fetchOnboardingProgress, firstRow, ensureUniqueOrgSlug, DEFAULT_ORG_PLAN, DEFAULT_ORG_TIMEZONE, INVITE_BULK_LIMIT, normalizeInviteNote } = req.app.locals;
	if (!ensureSupabase(res)) return;
	const context = requireUserContext(req, res);
	if (!context) return;

	// ...existing logic from server/index.js (see extraction phase)...
});

// GET /api/admin/onboarding/:orgId/invites
router.get('/:orgId/invites', async (req, res) => {
	// ...extracted logic...
});

// POST /api/admin/onboarding/:orgId/invites
router.post('/:orgId/invites', async (req, res) => {
	// ...extracted logic...
});

// POST /api/admin/onboarding/:orgId/invites/bulk
router.post('/:orgId/invites/bulk', async (req, res) => {
	// ...extracted logic...
});

// POST /api/admin/onboarding/:orgId/invites/:inviteId/resend
router.post('/:orgId/invites/:inviteId/resend', async (req, res) => {
	// ...extracted logic...
});

// DELETE /api/admin/onboarding/:orgId/invites/:inviteId
router.delete('/:orgId/invites/:inviteId', async (req, res) => {
	// ...extracted logic...
});

// GET /api/admin/onboarding/:orgId/progress
router.get('/:orgId/progress', async (req, res) => {
	// ...extracted logic...
});

// PATCH /api/admin/onboarding/:orgId/steps/:stepId
router.patch('/:orgId/steps/:stepId', async (req, res) => {
	// ...extracted logic...
});

export default router;
