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

export interface GithubTreeItem {
  path: string;
  sha: string;
  type: 'blob' | 'tree';
  size?: number;
  url?: string;
}
