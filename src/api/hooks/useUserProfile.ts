import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile } from '../client';
import type { GithubProfile } from '../types';

export const useUserProfile = (token?: string, owner?: string) => {
  return useQuery<GithubProfile>({
    queryKey: ['userProfile', owner],
    queryFn: () => fetchUserProfile(token, owner),
    enabled: !!token && !!owner,
    staleTime: 5 * 60 * 1000,
  });
};
