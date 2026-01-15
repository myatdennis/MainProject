import inviteService, { type AcceptInvitePayload } from '../services/inviteService';

export type { InvitePreview, AcceptInvitePayload, AcceptInviteResponse } from '../services/inviteService';

export const getInvite = (token: string) => inviteService.getInvite(token);
export const acceptInvite = (token: string, payload: AcceptInvitePayload) => inviteService.acceptInvite(token, payload);

export default {
  getInvite,
  acceptInvite,
};
