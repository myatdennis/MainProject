import apiRequest from '../utils/apiClient';
import type { OrgProfileMessage } from './orgService';

export type MessageChannel = 'email' | 'in_app';

export type SendMessagePayload = {
  subject?: string;
  body: string;
  channel?: MessageChannel;
  recipients?: string[];
  organizationId?: string | null;
};

export type AdminMessageRecord = OrgProfileMessage;

export const sendOrganizationMessage = async (organizationId: string, payload: SendMessagePayload) => {
  return apiRequest<{ data: AdminMessageRecord }>(`/api/admin/organizations/${organizationId}/messages`, {
    method: 'POST',
    body: payload,
  });
};

export const listOrganizationMessages = async (organizationId: string) => {
  return apiRequest<{ data: AdminMessageRecord[] }>(`/api/admin/organizations/${organizationId}/messages`);
};

export const sendUserMessage = async (userId: string, payload: SendMessagePayload) => {
  return apiRequest<{ data: AdminMessageRecord }>(`/api/admin/users/${userId}/messages`, {
    method: 'POST',
    body: payload,
  });
};

export const listUserMessages = async (userId: string) => {
  return apiRequest<{ data: AdminMessageRecord[] }>(`/api/admin/users/${userId}/messages`);
};
