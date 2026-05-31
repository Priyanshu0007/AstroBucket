import { useQuery } from '@tanstack/react-query';
import { fetchContents } from '../client';
import type { GithubFile } from '../types';

export const useRepoContents = (
  token?: string,
  owner?: string,
  repo?: string,
  branch?: string,
  path: string = ''
) => {
  return useQuery<GithubFile[]>({
    queryKey: ['repoContents', owner, repo, branch, path],
    queryFn: async () => {
      if (!owner || !repo || !branch) return [];
      const creds = { token: token || '', owner, repo, branch };
      return fetchContents(creds, path);
    },
    enabled: !!owner && !!repo && !!branch,
    staleTime: 30 * 1000,
  });
};
