import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteFile } from '../client';
import type { GithubCredentials } from '../types';

export interface DeleteFileParams {
  creds: GithubCredentials;
  path: string;
  sha: string;
  message?: string;
}

export const useDeleteFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creds, path, sha, message }: DeleteFileParams) => {
      return deleteFile(creds, path, sha, message);
    },
    onSuccess: (_, variables) => {
      const { owner, repo, branch } = variables.creds;
      queryClient.invalidateQueries({
        queryKey: ['repoContents', owner, repo, branch],
      });
      queryClient.invalidateQueries({
        queryKey: ['repoTree', owner, repo, branch],
      });
    },
  });
};
