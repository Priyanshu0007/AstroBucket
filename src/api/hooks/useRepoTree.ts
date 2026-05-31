import { useQuery } from '@tanstack/react-query';
import { fetchRepoTree } from '../client';
import type { GithubTreeItem } from '../types';

export const useRepoTree = (
  token?: string,
  owner?: string,
  repo?: string,
  branch?: string
) => {
  return useQuery<GithubTreeItem[]>({
    queryKey: ['repoTree', owner, repo, branch],
    queryFn: async () => {
      if (!owner || !repo || !branch) return [];
      const creds = { token: token || '', owner, repo, branch };
      return fetchRepoTree(creds);
    },
    enabled: !!owner && !!repo && !!branch,
    staleTime: 60 * 1000,
  });
};
