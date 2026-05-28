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
  message: string = 'Upload via AstroBucket',
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
  message: string = 'Delete via AstroBucket'
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

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  description: string | null;
  private: boolean;
  html_url: string;
  stargazers_count: number;
}

export interface GithubProfile {
  login: string;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

export const fetchUserRepos = async (token: string, owner: string): Promise<GithubRepo[]> => {
  const headers = getHeaders(token);
  
  // Try fetching org or user repos directly (public and private, depending on token scope)
  // First, we can try to fetch from /users/:username/repos, but this only returns public repos.
  // Using search or the user's specific repos is usually more complete.
  // Let's try listing the user's repos first, which returns all accessible repos for the authenticated user,
  // then we can filter by the specified owner.
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers });
    if (response.ok) {
      const data = await response.json();
      const filtered = data.filter((repo: any) => repo.owner.login.toLowerCase() === owner.toLowerCase());
      if (filtered.length > 0) {
        return filtered.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          default_branch: repo.default_branch || 'main',
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          stargazers_count: repo.stargazers_count || 0
        }));
      }
    }
  } catch (err) {
    console.error('Failed to list repos via user endpoint, falling back', err);
  }

  // Fallback to fetch from /users/:owner/repos (handles org or other user)
  const url = `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.map((repo: any) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    default_branch: repo.default_branch || 'main',
    description: repo.description,
    private: repo.private,
    html_url: repo.html_url,
    stargazers_count: repo.stargazers_count || 0
  }));
};

export const fetchUserProfile = async (token: string, owner: string): Promise<GithubProfile> => {
  const headers = getHeaders(token);
  const url = `https://api.github.com/users/${owner}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  const data = await response.json();
  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name,
    html_url: data.html_url
  };
};
