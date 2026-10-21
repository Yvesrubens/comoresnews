import test from 'node:test';
import assert from 'node:assert/strict';
import { quotaDisponible, LIMITES } from '../scripts/lib/newsletter-quota.mjs';

const NOW = new Date('2026-10-23T08:00:00Z');
const ilYa = (min) => new Date(NOW.getTime() - min * 60000);
const n = (count, min) => Array.from({ length: count }, () => ilYa(min));

test("quotaDisponible tient compte de l'heure et des 24 h glissantes", () => {
  assert.deepEqual(LIMITES, { parMinute: 100, parHeure: 900, parJour: 7000 });
  assert.equal(quotaDisponible([], NOW), 100);
  assert.equal(quotaDisponible(n(900, 30), NOW), 0);
  assert.equal(quotaDisponible(n(900, 61), NOW), 100);
  // 6 950 envois répartis sur les 23 dernières heures, aucun dans la dernière heure
  const jour = Array.from({ length: 6950 }, (_, i) => ilYa(61 + (i % (22 * 60))));
  assert.equal(quotaDisponible(jour, NOW), 50);
  assert.equal(quotaDisponible(n(30, 0.5), NOW), 70);
  assert.equal(quotaDisponible(n(950, 10), NOW), 0); // jamais négatif
});
