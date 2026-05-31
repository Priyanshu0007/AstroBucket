import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'dns'

// Ensure local server resolves localhost correctly
dns.setDefaultResultOrder('verbatim')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'github-oauth-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/auth/github') && req.method === 'POST') {
              try {
                // Parse body
                let body = '';
                for await (const chunk of req) {
                  body += chunk;
                }
                const { code } = JSON.parse(body);

                if (!code) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Code parameter is required' }));
                  return;
                }

                // Dev backdoor: if code starts with mock_code_, extract token and fetch profile
                if (code.startsWith('mock_code_')) {
                  const mockToken = code.replace('mock_code_', '');
                  const userRes = await fetch('https://api.github.com/user', {
                    headers: {
                      Authorization: `Bearer ${mockToken}`,
                      Accept: 'application/json',
                      'User-Agent': 'AstroBucket-Dev'
                    }
                  });
                  if (!userRes.ok) {
                    throw new Error(`Failed to fetch GitHub profile: ${userRes.statusText}`);
                  }
                  const user = await userRes.json();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ access_token: mockToken, user }));
                  return;
                }

                // Real exchange
                const clientId = env.VITE_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
                const clientSecret = env.GITHUB_CLIENT_SECRET;

                if (!clientId || !clientSecret) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    error: 'GitHub Client ID or Client Secret is not configured in local environment variables.',
                    devMode: true
                  }));
                  return;
                }

                const response = await fetch('https://github.com/login/oauth/access_token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                  },
                  body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code
                  })
                });

                const data = (await response.json()) as any;
                if (data.error) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: data.error_description || data.error }));
                  return;
                }

                const accessToken = data.access_token;
                
                // Fetch user profile
                const userRes = await fetch('https://api.github.com/user', {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'User-Agent': 'AstroBucket'
                  }
                });
                
                if (!userRes.ok) {
                  throw new Error('Failed to fetch user profile from GitHub');
                }
                
                const user = await userRes.json();
                
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ access_token: accessToken, user }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'OAuth exchange failed' }));
              }
              return;
            }
            next();
          });
        }
      }
    ]
  };
})
