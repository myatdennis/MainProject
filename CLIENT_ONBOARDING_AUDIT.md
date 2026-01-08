# Client Onboarding Flow Audit

## Goals
- Ensure platform teams can add a new client org with minimal coordination.
- Give non-technical client admins clear guidance from invite through first login.
- Provide product/CS teams the telemetry needed to resolve issues quickly.

## Recommended End-to-End Flow
1. **Create Organization**
   - Form enforces unique org slug + display name, optional industry tags, and default timezone.
   - Immediately assigns default plan + sandbox environment so the org can explore while contracts finalize.
   - Auto-generates welcome checklist entry (see section below).
2. **Assign Owner/Admin**
   - Creator must select at least one owner; prompt to add a backup admin for redundancy.
   - Owner inherits `org_owner` role plus contextual `content.edit` if content migration is expected.
   - Show summary card of the owner’s permissions before saving.
3. **Invite Additional Members**
   - Bulk invite modal accepts CSV, manual emails, or “copy link” with quota + expiration.
   - Role defaults mapped to job function (Owner, Admin, Manager, Instructor, Read-only) with tooltips describing scope.
   - Duplicates surfaced inline with “Resend invite” option instead of blocking the flow.
4. **Users Accept Invite & Log In**
   - Email contains **Join button** (magic link) plus fallback copy/paste code; expires in 72h.
   - Landing page confirms org logo/name, summarizes what they’ll get access to, and requires password + MFA enrollment when policy demands.
   - On first login, users select their team/cohort (if more than one) and acknowledge acceptable-use policy.
5. **Organization Starts Using the App**
   - Post-login checklist shows 3–5 milestones (upload branding, add first course, invite learners, review analytics) with progress indicator.
   - System creates an “Activation timeline” entry visible to internal staff with timestamps of each milestone.

## Guardrails & Failure States
- **Role defaults**: Owner → `org_owner`, Admin → `org_admin`, Manager → `manager`, Instructor → `instructor`, Viewer → `member`. Auto-downgrade to `member` if no role provided.
- **Duplicate invites**: Surface banner “Already invited on <date>; resend?” with single-click resend + audit entry.
- **Inactive users**: Dashboard pill shows “4 invites pending >7 days”; allow bulk resend or revoke. Auto-expire invites after 30 days.
- **Email deliverability**: Once invites sent, display status chips (Queued/Sent/Bounced). Bounced entries prompt alternative contact method.
- **Failure recovery**: If org creation fails, keep draft with error context and provide retry. If invite fails, store event and notify internal Slack channel.

## Email Content Suggestions
**Subject**: “You’ve been invited to <Org Name> on <Platform>”

**Body outline**:
1. Personalized greeting with inviter’s name + role.
2. Value prop: “Access training, analytics, and resources in one place.”
3. Primary CTA button “Join <Org Name>” (magic link) + expiry note.
4. Secondary instructions: redemption code + portal URL.
5. Security footer: “Didn’t expect this? Contact support@example.com or ignore.”
6. PS: highlight onboarding webinar/guide link.

**Reminder Email (72h later)**
- Friendly nudge referencing pending invite, include progress (“2 of 5 teammates already joined”).

## UI Messaging & Progress Indicators
- Wizard banner across admin console showing steps with completion %.
- Inline validation for required fields with friendly copy (“Give this organization a recognizable name so learners can find it”).
- Toast/snackbar after each stage (“3 invites sent • track status in Invites tab”).
- On org dashboard, show “Onboarding progress” card with checkboxes for: Configure branding, Invite teammates, Launch first course, Review analytics.

## Friction Log
| Step | Potential Friction | Proposed Mitigation |
| --- | --- | --- |
| Create org | Unsure what to input for slug | Provide auto-suggest + tooltip explaining usage |
| Assign owner | Creator forgets backup admin | Inline reminder + skip confirmation modal noting risk |
| Invite members | CSV formatting errors | Downloadable template + validation preview |
| Invite delivery | Email caught in spam | Provide copyable secure URL + SMS fallback (if phone available) |
| Acceptance | Users confused about MFA requirement | Pre-invite email mentions MFA + quick explainer on landing page |
| First login | Users don’t know next action | Checklist + welcome tour highlights key tasks |
| Activation tracking | Success team lacks visibility | Internal dashboard showing timestamps for each milestone |

## Additional Recommendations
- **Audit logging**: capture actions (org created, owner assigned, invite sent/rescinded, invite accepted, first login) with actor, org, and metadata for compliance.
- **Operational playbook**: scripted checklist for CSMs covering: pre-flight data, contract linkage, who to ping if invites bounce, and what to monitor day 1/7/30.
- **Future-proofing**: add service account support for automated provisioning (SCIM) and webhook events for “org_ready” + “user_invited”.
