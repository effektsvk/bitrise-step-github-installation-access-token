const jwt = require('jsonwebtoken');

const appId = process.env.app_id;
const privateKey = process.env.private_key;
const repositoryName = process.env.repository_name;

if (!appId || !privateKey) {
  console.error('App ID or Private Key is not set. Please provide both inputs.');
  process.exit(1);
}

async function generateJWTandGetToken() {
  try {
    // Generate JWT
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (10 * 60),  // 10 minutes from now
      iss: appId
    };

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    // get Installation ID

    const installationIdResponse = await fetch(`https://api.github.com/repos/${repositoryName}/installation`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!installationIdResponse.ok) {
      throw new Error(`HTTP error! status: ${installationIdResponse.status}`);
    }

    const installationIdData = await installationIdResponse.json();
    const installationId = installationIdData.id;

    if (!installationId) {
      throw new Error('Installation ID not found');
    }

    // Exchange JWT for access token
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const accessToken = data.token;

    // Output the access token
    console.log(`::set-output name=access_token::${accessToken}`);
    console.log('Access token generated successfully.');

  } catch (error) {
    console.error('Error generating access token:', error.message);
    process.exit(1);
  }
}

generateJWTandGetToken();
