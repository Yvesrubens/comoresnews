import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghClient } from '../admin/github.mjs';

test('listDir renvoie les fichiers', async () => {
  const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async () =>
    ({ ok:true, status:200, json: async () => ([{ name:'a.md', path:'content/articles/a.md' }]) }) });
  const l = await gh.listDir('content/articles');
  assert.equal(l[0].name, 'a.md');
});
test('putFile inclut sha si fourni (update)', async () => {
  let cap; const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async (u,o)=>{ cap=o; return { ok:true, status:200, json:async()=>({}) }; } });
  await gh.putFile('p.md', 'B64', 'msg', 'SHA123');
  assert.equal(JSON.parse(cap.body).sha, 'SHA123');
});
test('putFile sans sha (creation) n_inclut pas sha', async () => {
  let cap; const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async (u,o)=>{ cap=o; return { ok:true, status:201, json:async()=>({}) }; } });
  await gh.putFile('p.md', 'B64', 'msg');
  assert.equal('sha' in JSON.parse(cap.body), false);
});
test('deleteFile envoie DELETE avec sha', async () => {
  let cap; const gh = ghClient({ token:'t', repo:'o/r', fetchImpl: async (u,o)=>{ cap=o; return { ok:true, status:200, json:async()=>({}) }; } });
  await gh.deleteFile('p.md', 'SHA', 'msg');
  assert.equal(cap.method, 'DELETE');
  assert.equal(JSON.parse(cap.body).sha, 'SHA');
});
