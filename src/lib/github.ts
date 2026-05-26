export interface GithubCredentials {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface GithubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

const getHeaders = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

export const getCdnUrl = (owner: string, repo: string, branch: string, path: string) => {
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
};

export const fetchContents = async (
  creds: GithubCredentials,
  path: string = ''
): Promise<GithubFile[]> => {
  const { owner, repo, branch, token } = creds;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  
  const response = await fetch(url, { headers: getHeaders(token) });
  
  if (!response.ok) {
    if (response.status === 404) {
      return []; // Return empty if directory not found (e.g. empty repo)
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
};

export const uploadFile = async (
  creds: GithubCredentials,
  path: string,
  contentBase64: string,
  message: string = 'Upload via GitHub S3 Explorer',
  sha?: string
) => {
  const { owner, repo, branch, token } = creds;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const body: any = {
    message,
    content: contentBase64,
    branch,
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to upload file');
  }
  
  return response.json();
};

export const deleteFile = async (
  creds: GithubCredentials,
  path: string,
  sha: string,
  message: string = 'Delete via GitHub S3 Explorer'
) => {
  const { owner, repo, branch, token } = creds;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(token),
    body: JSON.stringify({
      message,
      sha,
      branch,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete file');
  }
  
  return response.json();
};

// Utility to convert File to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '');
      if ((encoded?.length ?? 0) % 4 > 0) {
        encoded += '='.repeat(4 - ((encoded?.length ?? 0) % 4));
      }
      resolve(encoded || '');
    };
    reader.onerror = (error) => reject(error);
  });
};
