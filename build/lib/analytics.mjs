// Intégration Google Analytics 4 (gtag.js).
// L'ID de mesure peut être surchargé par la variable d'env GA4_ID.
export const GA4_ID = process.env.GA4_ID || 'G-HQYDPXBMDY';

// Bloc <head> : chargement de gtag.js + config (une fois par page).
export function ga4Snippet(id = GA4_ID) {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
</script>`;
}

// Injecte GA4 dans le <head> d'une page HTML complète.
// Idempotent : ne fait rien si le tag est déjà présent ou si l'ID est vide.
export function injectAnalytics(html, id = GA4_ID) {
  if (!id || /googletagmanager\.com\/gtag\/js/.test(html)) return html;
  return html.replace('</head>', `${ga4Snippet(id)}\n</head>`);
}
