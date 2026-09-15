import test from 'node:test';
import assert from 'node:assert/strict';
import { ga4Snippet, injectAnalytics } from '../build/lib/analytics.mjs';

test('ga4Snippet contient gtag.js et l\'ID de config', () => {
  const s = ga4Snippet('G-TEST123');
  assert.match(s, /googletagmanager\.com\/gtag\/js\?id=G-TEST123/);
  assert.match(s, /gtag\('config', 'G-TEST123'\)/);
});

test('injectAnalytics insère le tag dans le <head>', () => {
  const out = injectAnalytics('<html><head><title>x</title></head><body></body></html>', 'G-TEST123');
  assert.match(out, /gtag\/js\?id=G-TEST123[\s\S]*<\/head>/);
});

test('injectAnalytics est idempotent', () => {
  const once = injectAnalytics('<head></head>', 'G-TEST123');
  const twice = injectAnalytics(once, 'G-TEST123');
  assert.equal((twice.match(/gtag\/js/g) || []).length, 1);
});

test('injectAnalytics ne fait rien si ID vide', () => {
  const html = '<head></head>';
  assert.equal(injectAnalytics(html, ''), html);
});
