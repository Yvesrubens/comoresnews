import test from 'node:test';
import assert from 'node:assert/strict';
import { injectConsent, CONSENT_TAGS } from '../build/lib/consent.mjs';

test('injectConsent place le CMP juste après <head>', () => {
  const out = injectConsent('<html><head><meta charset="utf-8"><title>x</title></head><body></body></html>');
  assert.match(out, /<head>\s*<script[^>]*consentframework\.com/);
});

test('injectConsent est idempotent', () => {
  const once = injectConsent('<head></head>');
  const twice = injectConsent(once);
  assert.equal((twice.match(/cache\.consentframework\.com/g) || []).length, 1);
});

test('le CMP est placé AVANT le tag GA4 si présent', () => {
  const html = '<head><script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script></head>';
  const out = injectConsent(html);
  assert.ok(out.indexOf('consentframework.com') < out.indexOf('gtag/js'), 'CMP doit précéder GA4');
});

test('CONSENT_TAGS contient le stub et le cmp', () => {
  assert.match(CONSENT_TAGS, /\/stub"/);
  assert.match(CONSENT_TAGS, /\/cmp"/);
});
