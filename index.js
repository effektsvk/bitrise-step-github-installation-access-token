const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');

const appId = process.env.APP_ID;
const privateKey = process.env.PRIVATE_KEY;
const repositoryUrl = process.env.REPO_URL;

function parseGitUrl(url) {
  let owner, repo, host;

  // SSH URL format
  const sshRegex = /^git@([^:]+):([^/]+)\/(.+)\.git$/;
  // HTTPS URL format
  const httpsRegex = /^https?:\/\/([^/]+)\/([^/]+)\/(.+)\.git$/;

  if (sshRegex.test(url)) {
    [, host, owner, repo] = url.match(sshRegex);
  } else if (httpsRegex.test(url)) {
    [, host, owner, repo] = url.match(httpsRegex);
  } else {
    throw new Error('Invalid Git URL format, URL: ' + url);
  }

  return { host, owner, repo };
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

    const { owner, repo } = parseGitUrl(repositoryUrl);

    // Get Installation ID
    const installationIdResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
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

    // Use envman to set the access token as an environment variable
    execSync(`envman add --key GITHUB_ACCESS_TOKEN --value "${accessToken}"`);
    console.log('Access token generated and saved to GITHUB_ACCESS_TOKEN environment variable.');
  } catch (error) {
    console.error('Error generating access token:', error.message);
    process.exit(1);
  }
}

generateJWTandGetToken();
