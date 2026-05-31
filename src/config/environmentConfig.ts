/**
 * environmentConfig.ts
 * 
 * Centralized client-side configuration parameters mapping Vite environment variables.
 */
export const environmentConfig = {
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  githubRedirectUri: import.meta.env.VITE_GITHUB_REDIRECT_URI || window.location.origin,
};
