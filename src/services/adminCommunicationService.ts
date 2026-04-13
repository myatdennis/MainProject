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

const unwrapApiData = <T,>(payload: T | { data?: T } | null | undefined): T | null => {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? null) as T | null;
  }
  return (payload ?? null) as T | null;
};

export const sendOrganizationMessage = async (organizationId: string, payload: SendMessagePayload) => {
  const response = await apiRequest<AdminMessageRecord | { data?: AdminMessageRecord }>(
    `/api/admin/organizations/${organizationId}/messages`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return unwrapApiData(response);
};

export const listOrganizationMessages = async (organizationId: string) => {
  const response = await apiRequest<AdminMessageRecord[] | { data?: AdminMessageRecord[] }>(
    `/api/admin/organizations/${organizationId}/messages`,
  );
  return unwrapApiData(response) ?? [];
};

export const sendUserMessage = async (userId: string, payload: SendMessagePayload) => {
  const response = await apiRequest<AdminMessageRecord | { data?: AdminMessageRecord }>(
    `/api/admin/users/${userId}/messages`,
    {
      method: 'POST',
      body: payload,
    },
  );
  return unwrapApiData(response);
};

export const listUserMessages = async (userId: string) => {
  const response = await apiRequest<AdminMessageRecord[] | { data?: AdminMessageRecord[] }>(
    `/api/admin/users/${userId}/messages`,
  );
  return unwrapApiData(response) ?? [];
};
