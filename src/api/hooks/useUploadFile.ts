import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFile } from '../client';
import type { GithubCredentials } from '../types';

export interface UploadFileParams {
  creds: GithubCredentials;
  path: string;
  contentBase64: string;
  message?: string;
  sha?: string;
}

export const useUploadFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creds, path, contentBase64, message, sha }: UploadFileParams) => {
      return uploadFile(creds, path, contentBase64, message, sha);
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
