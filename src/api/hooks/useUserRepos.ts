import { useQuery } from '@tanstack/react-query';
import { fetchUserRepos } from '../client';
import type { GithubRepo } from '../types';

export const useUserRepos = (token?: string, owner?: string) => {
  return useQuery<GithubRepo[]>({
    queryKey: ['userRepos', owner],
    queryFn: () => fetchUserRepos(token, owner),
    enabled: !!token && !!owner,
    staleTime: 5 * 60 * 1000,
  });
};
