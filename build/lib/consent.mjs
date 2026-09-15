// CMP (Consent Management Platform) — bandeau de consentement RGPD.
// Doit être injecté LE PLUS HAUT POSSIBLE dans le <head>, avant tous les autres
// tags (GA4, régie pub, etc.).
export const CONSENT_TAGS = `<script type="text/javascript" src="https://cache.consentframework.com/js/pa/23752/c/fzJzt/stub" data-cfasync="false" referrerpolicy="unsafe-url"></script>
<script type="text/javascript" src="https://choices.consentframework.com/js/pa/23752/c/fzJzt/cmp" data-cfasync="false" referrerpolicy="unsafe-url" async></script>`;

// Insère le CMP juste après l'ouverture du <head> (position la plus haute).
// Idempotent : ne fait rien si le CMP est déjà présent.
export function injectConsent(html, tags = CONSENT_TAGS) {
  if (/consentframework\.com/.test(html)) return html;
  return html.replace(/(<head[^>]*>)/i, `$1\n${tags}`);
}
