export function ghClient({ token, repo, fetchImpl = fetch, branch = 'main' }) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  return {
    async getRepo() {
      const r = await fetchImpl(base, { headers });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      return r.json();
    },
    async fileExists(path) {
      const r = await fetchImpl(`${base}/contents/${path}`, { headers });
      return r.ok;
    },
    async putFile(path, contentBase64, message, sha) {
      const payload = { message, content: contentBase64, branch };
      if (sha) payload.sha = sha;
      const r = await fetchImpl(`${base}/contents/${path}`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`Publication échouée (GitHub ${r.status})`);
      return r.json();
    },
    async listDir(path) {
      const r = await fetchImpl(`${base}/contents/${path}`, { headers });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      return r.json();
    },
    async getFile(path) {
      const r = await fetchImpl(`${base}/contents/${path}`, { headers });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      const j = await r.json();
      const text = new TextDecoder().decode(
        Uint8Array.from(atob(String(j.content).replace(/\n/g, '')), (c) => c.charCodeAt(0)));
      return { text, sha: j.sha };
    },
    async deleteFile(path, sha, message) {
      const r = await fetchImpl(`${base}/contents/${path}`, {
        method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sha, branch }),
      });
      if (!r.ok) throw new Error(`Suppression échouée (GitHub ${r.status})`);
      return r.json();
    },
  };
}

// Encodage UTF-8 -> base64 (navigateur)
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
