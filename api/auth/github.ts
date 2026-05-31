/**
 * /api/auth/github.ts
 * 
 * Vercel Serverless Function to exchange OAuth `code` for an access token.
 * Prevents exposing `client_secret` to client browsers.
 */

export default async function handler(req: any, res: any) {
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
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code parameter is required' });
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
      return res.status(200).json({ access_token: mockToken, user });
    }

    // Real OAuth exchange
    const clientId = process.env.VITE_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'GitHub Client ID or Client Secret is not configured on the serverless backend.'
      });
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

    const data = await response.json();
    if (data.error) {
      return res.status(400).json({ error: data.error_description || data.error });
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
    return res.status(200).json({ access_token: accessToken, user });
  } catch (err: any) {
    console.error('OAuth proxy exchange error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
