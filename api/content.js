// Vercel Function: GET vrací content.json, POST ho uloží do GitHubu
// Env vars (nastavit ve Vercel dashboardu):
//   GITHUB_TOKEN    — GitHub Personal Access Token s právem 'repo'
//   ADMIN_PASSWORD  — heslo, které bude uživatel zadávat v adminu

const REPO_OWNER = 'JakubSpernoga';
const REPO_NAME = 'Utulek';
const CONTENT_PATH = 'content.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  // CORS — povolíme volání i z GitHub Pages domény, kdyby běžely paralelně
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${CONTENT_PATH}?t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!r.ok) throw new Error('GitHub raw fetch failed: ' + r.status);
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { password, content } = req.body || {};

    if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
      return res.status(500).json({ error: 'Server není nastavený (chybí env vars).' });
    }
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Špatné heslo.' });
    }
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Neplatný obsah.' });
    }

    try {
      // Načteme aktuální SHA
      const getRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONTENT_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: 'token ' + process.env.GITHUB_TOKEN } }
      );
      if (!getRes.ok) {
        const err = await getRes.json();
        throw new Error('Načtení SHA selhalo: ' + (err.message || getRes.status));
      }
      const getData = await getRes.json();

      // Zapíšeme nový obsah
      const body = {
        message: 'Aktualizace obsahu z administrace',
        content: Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64'),
        sha: getData.sha,
        branch: BRANCH,
      };

      const putRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONTENT_PATH}`,
        {
          method: 'PUT',
          headers: {
            Authorization: 'token ' + process.env.GITHUB_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || 'Zápis selhal');
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
