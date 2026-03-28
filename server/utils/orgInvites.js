export const buildOrgInviteInsertAttemptPayloads = ({
  orgColumn,
  tokenColumn,
  orgId,
  token,
  basePayload = {},
}) => {
  const payload = {
    ...basePayload,
    [orgColumn]: orgId,
    [tokenColumn]: token,
  };

  const attempts = [payload];
  if (Object.prototype.hasOwnProperty.call(payload, 'token')) {
    const withoutToken = { ...payload };
    delete withoutToken.token;
    attempts.push(withoutToken);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'invite_token')) {
    const withoutInviteToken = { ...payload };
    delete withoutInviteToken.invite_token;
    attempts.push(withoutInviteToken);
  }
  return attempts;
};
