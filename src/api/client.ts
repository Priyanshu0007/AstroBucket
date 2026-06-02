import axios from 'axios';
import type {
  GithubCredentials,
  GithubFile,
  GithubRepo,
  GithubProfile,
  GithubTreeItem,
  GithubRawRepo
} from './types';

export const apiClient = axios.create({
  baseURL: 'https://api.github.com',
});

apiClient.interceptors.request.use((config) => {
  const sessionStr = localStorage.getItem('astrobucket-session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      if (session.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
      }
    } catch (e) {
      console.error('Error parsing session for API request', e);
    }
  }
  if (!config.headers.Accept) {
    config.headers.Accept = 'application/vnd.github+json';
  }
  config.headers['X-GitHub-Api-Version'] = '2022-11-28';
  return config;
});

export const getCdnUrl = (owner: string, repo: string, branch: string, path: string) => {
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
};

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

export const fetchUserProfile = async (token?: string, owner?: string): Promise<GithubProfile> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = owner ? `/users/${owner}` : '/user';
  const response = await apiClient.get<GithubProfile>(url, { headers });
  return response.data;
};

export const fetchUserRepos = async (token?: string, owner?: string): Promise<GithubRepo[]> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const response = await apiClient.get('/user/repos?per_page=100&sort=updated', { headers });
    const filtered = (response.data as GithubRawRepo[]).filter(
      (repo) => repo.owner.login.toLowerCase() === owner?.toLowerCase()
    );
    if (filtered.length > 0) {
      return filtered.map((repo) => ({
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
  } catch (err) {
    console.error('Failed to list repos via user endpoint, falling back', err);
  }

  const response = await apiClient.get<GithubRawRepo[]>(`/users/${owner}/repos?per_page=100&sort=updated`, { headers });
  return response.data.map((repo) => ({
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

export const fetchContents = async (
  creds: GithubCredentials,
  path: string = ''
): Promise<GithubFile[]> => {
  const { owner, repo, branch, token } = creds;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await apiClient.get(`/repos/${owner}/${repo}/contents/${path}`, {
      params: { ref: branch, _: Date.now() },
      headers
    });
    const data = response.data;
    const filesList = Array.isArray(data) ? data : [data];
    return filesList.filter((file: GithubFile) => file.name !== '.gitkeep');
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        return [];
      }
    }
    throw err;
  }
};

export const fetchFileRaw = async (
  creds: GithubCredentials,
  path: string
): Promise<Blob> => {
  const { owner, repo, branch, token } = creds;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await apiClient.get(`/repos/${owner}/${repo}/contents/${path}`, {
    params: { ref: branch },
    headers,
    responseType: 'blob'
  });
  return response.data;
};

export const uploadFile = async (
  creds: GithubCredentials,
  path: string,
  contentBase64: string,
  message: string = 'Upload via AstroBucket',
  sha?: string
) => {
  const { owner, repo, branch, token } = creds;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  interface UploadFileBody {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  }

  const body: UploadFileBody = {
    message,
    content: contentBase64,
    branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await apiClient.put(`/repos/${owner}/${repo}/contents/${path}`, body, {
    headers
  });
  return response.data;
};

export const deleteFile = async (
  creds: GithubCredentials,
  path: string,
  sha: string,
  message: string = 'Delete via AstroBucket'
) => {
  const { owner, repo, branch, token } = creds;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await apiClient.delete(`/repos/${owner}/${repo}/contents/${path}`, {
    data: {
      message,
      sha,
      branch
    },
    headers
  });
  return response.data;
};

export const fetchRepoTree = async (
  creds: GithubCredentials
): Promise<GithubTreeItem[]> => {
  const { owner, repo, branch, token } = creds;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await apiClient.get(`/repos/${owner}/${repo}/git/trees/${branch}`, {
    params: { recursive: '1', _: Date.now() },
    headers
  });
  return response.data.tree || [];
};
