import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const t of ['home', 'article']) {
  test(`« Suivez nous » (${t}) : pas de chiffres, seulement les réseaux et leurs boutons`, () => {
    const h = fs.readFileSync(new URL(`../templates/${t}.html`, import.meta.url), 'utf8');
    const i = h.indexOf('td_block_social_counter tdi_62');
    const bloc = h.slice(i, h.indexOf('</div></div></div></div>', i));
    assert.ok(i > 0, 'bloc présent');
    assert.doesNotMatch(bloc, /td_social_info_counter/);
    assert.doesNotMatch(bloc, /16,985|2,458|61,453/);
    for (const r of ['Facebook', 'X', 'YouTube']) assert.match(bloc, new RegExp(`td_social_info_name">${r}<`));
    for (const b of ["J'aime", 'Suivre', "S'abonner"]) assert.ok(bloc.includes(b), b);
  });
}
