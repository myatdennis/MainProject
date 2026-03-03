import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiRequest from '../utils/apiClient';
import { queryKeys } from '../query/queryKeys';
import { getUserSession } from '../lib/secureStorage';
import { isAdminSurface } from '../utils/surface';

export interface UserProfileLegacy {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  organizationId?: string;
}

interface ClientMeResponse {
  data?: {
    userId: string;
    email?: string | null;
    displayName?: string | null;
    role?: string | null;
    orgId?: string | null;
  } | null;
}

interface AdminMeResponse {
  user?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    organizationId?: string | null;
  };
}

const readSessionUser = (): UserProfileLegacy | null => {
  try {
    const session = getUserSession();
    if (!session) {
      return null;
    }
    return {
      id: session.id,
      email: session.email,
      firstName: session.firstName ?? (session.userMetadata as Record<string, any> | undefined)?.first_name,
      lastName: session.lastName ?? (session.userMetadata as Record<string, any> | undefined)?.last_name,
      role: session.role ?? session.platformRole ?? undefined,
      organizationId: session.activeOrgId ?? session.organizationId ?? undefined,
    };
  } catch (error) {
    console.warn('[useUserProfile] Failed to read secure session:', error);
    return null;
  }
};

// Fetcher attempts remote first; if remote fails returns legacy local copy.
const fetchUserProfile = async (): Promise<UserProfileLegacy | null> => {
  const adminSurface = isAdminSurface();
  if (adminSurface) {
    try {
      const json = await apiRequest<AdminMeResponse>('/api/admin/me', { noTransform: true });
      if (json?.user?.id) {
        return {
          id: json.user.id,
          email: json.user.email,
          firstName: json.user.firstName,
          lastName: json.user.lastName,
          role: json.user.role,
          organizationId: json.user.organizationId ?? undefined,
        };
      }
    } catch {
      // swallow and fall through
    }
  } else {
    try {
      const json = await apiRequest<ClientMeResponse>('/api/client/me', { noTransform: true });
      if (json?.data?.userId) {
        return {
          id: json.data.userId,
          email: json.data.email ?? undefined,
          firstName: json.data.displayName ?? undefined,
          lastName: undefined,
          role: json.data.role ?? undefined,
          organizationId: json.data.orgId ?? undefined,
        };
      }
    } catch {
      // swallow and fall through
    }
  }
  return readSessionUser();
};

export const useUserProfile = () => {
  const queryClient = useQueryClient();

  // Seed cache from legacy storage synchronously to avoid layout shift.
  const legacy = readSessionUser();
  if (legacy) {
    queryClient.setQueryData(queryKeys.auth.user(), legacy);
  }

  const query = useQuery({
    queryKey: queryKeys.auth.user(),
    queryFn: fetchUserProfile,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export default useUserProfile;
