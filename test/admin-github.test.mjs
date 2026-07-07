import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghClient } from '../admin/github.mjs';

function fakeFetch(routes) {
  return async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${url}`;
    const r = routes[key];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: r.status < 400, status: r.status, json: async () => r.body || {} };
  };
}

test('getRepo appelle la bonne URL', async () => {
  const gh = ghClient({ token: 't', repo: 'o/r', fetchImpl:
    fakeFetch({ 'GET https://api.github.com/repos/o/r': { status: 200, body: { full_name: 'o/r' } } }) });
  const r = await gh.getRepo();
  assert.equal(r.full_name, 'o/r');
});

test('fileExists true/false', async () => {
  const gh = ghClient({ token: 't', repo: 'o/r', fetchImpl:
    fakeFetch({ 'GET https://api.github.com/repos/o/r/contents/x.md': { status: 200, body: { sha: 'abc' } } }) });
  assert.equal(await gh.fileExists('x.md'), true);
  assert.equal(await gh.fileExists('absent.md'), false);
});

test('putFile envoie PUT avec message et contenu', async () => {
  let captured;
  const fetchImpl = async (url, opts) => { captured = { url, opts }; return { ok: true, status: 201, json: async () => ({ content: { path: 'content/articles/s.md' } }) }; };
  const gh = ghClient({ token: 't', repo: 'o/r', fetchImpl });
  await gh.putFile('content/articles/s.md', 'BASE64', 'Publication: T');
  assert.match(captured.url, /contents\/content\/articles\/s\.md$/);
  assert.equal(captured.opts.method, 'PUT');
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.message, 'Publication: T');
  assert.equal(body.content, 'BASE64');
  assert.equal(body.branch, 'main');
});
