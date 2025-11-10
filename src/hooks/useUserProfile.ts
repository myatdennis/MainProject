import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiRequest from '../utils/apiClient';
import { queryKeys } from '../query/queryKeys';

export interface UserProfileLegacy {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  organizationId?: string;
}

interface RemoteProfileResponse {
  data?: UserProfileLegacy | null;
}

const readLegacyUser = (): UserProfileLegacy | null => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('huddle_user') : null;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Fetcher attempts remote first; if remote fails returns legacy local copy.
const fetchUserProfile = async (): Promise<UserProfileLegacy | null> => {
  // Attempt remote endpoint (if implemented). If not available gracefully fallback.
  try {
    const json = await apiRequest<RemoteProfileResponse>('/api/client/profile', { method: 'GET', noTransform: true });
    if (json?.data) return json.data;
  } catch (e: any) {
    // Swallow 404 / network and fallback
  }
  return readLegacyUser();
};

export const useUserProfile = () => {
  const queryClient = useQueryClient();

  // Seed cache from legacy storage synchronously to avoid layout shift.
  const legacy = readLegacyUser();
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