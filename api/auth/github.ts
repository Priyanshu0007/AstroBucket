import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  body: {
    code?: string;
  };
  method?: string;
}

interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  json(body: Record<string, string | number | boolean | object | null | undefined>): void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Code parameter is required' });
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
        throw new Error(`GitHub token verification failed: ${userRes.statusText}`);
      }
      
      const user = await userRes.json();
      res.status(200).json({ access_token: mockToken, user });
      return;
    }

    // Real OAuth exchange
    const clientId = process.env.VITE_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).json({
        error: 'GitHub Client ID or Client Secret is not configured on the serverless backend.'
      });
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

    const data = await response.json() as { access_token?: string; error?: string; error_description?: string };
    if (data.error) {
      res.status(400).json({ error: data.error_description || data.error });
      return;
    }

    const accessToken = data.access_token;

    // Fetch user profile info
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'AstroBucket'
      }
    });

    if (!userRes.ok) {
      throw new Error('Failed to retrieve user profile from GitHub API');
    }

    const user = await userRes.json();
    res.status(200).json({ access_token: accessToken || '', user });
    return;
  } catch (err) {
    console.error('OAuth proxy exchange error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({ error: message });
    return;
  }
}
