// api/rules.js — Vercel serverless function
// Handles GET (read rules) and POST (add rule) requests
// 
// Required environment variables in Vercel dashboard:
//   GITHUB_TOKEN   — Personal access token with repo write scope
//   GITHUB_OWNER   — e.g. nlieurance
//   GITHUB_REPO    — e.g. content-tool
//   GITHUB_FILE    — e.g. example-rules.json
//   WRITE_SECRET   — any secret string your team uses to authorize writes

const GITHUB_API = 'https://api.github.com';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getFile() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_FILE } = process.env;
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { rules: JSON.parse(content), sha: data.sha };
}

async function putFile(rules, sha) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_FILE } = process.env;
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
  const content = Buffer.from(JSON.stringify(rules, null, 2)).toString('base64');
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Add rule via Content Tool plugin',
      content,
      sha,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub PUT failed: ${res.status} — ${err.message}`);
  }
  return res.json();
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Secret');
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  cors(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET — return all rules
  if (req.method === 'GET') {
    try {
      const { rules } = await getFile();
      return res.status(200).json(rules);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — append a new rule
  if (req.method === 'POST') {
    // Check secret
    const secret = req.headers['x-write-secret'];
    if (!secret || secret !== process.env.WRITE_SECRET) {
      return res.status(401).json({ error: 'Invalid write secret' });
    }

    const rule = req.body;

    // Basic validation
    if (!rule || !rule.pattern || !rule.type || !rule.severity) {
      return res.status(400).json({ error: 'Missing required fields: type, pattern, severity' });
    }

    try {
      const { rules, sha } = await getFile();

      // Generate next ID
      const ids = rules
        .map(r => parseInt((r.id || 'SG000').replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n));
      const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      rule.id = 'SG' + String(nextId).padStart(3, '0');

      rules.push(rule);
      await putFile(rules, sha);

      return res.status(200).json({ success: true, rule });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
