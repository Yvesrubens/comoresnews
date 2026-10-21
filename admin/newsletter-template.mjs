// Gabarit de la newsletter hebdomadaire : un seul module pour l'aperçu du
// back-office (navigateur) et pour le script d'envoi (Node).
import { articleUrl } from './lib.mjs';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
const COMORES_MS = 3 * 3600 * 1000; // UTC+3

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const isHttp = (u) => /^https?:\/\//i.test(String(u || ''));

// « Comoresnews — l'essentiel de la semaine du 19 au 25 octobre » (semaine lundi→dimanche, heure des Comores)
export function weekSubject(now) {
  const local = new Date(now.getTime() + COMORES_MS);
  const offset = (local.getUTCDay() + 6) % 7; // lundi = 0
  const lundi = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - offset));
  const dimanche = new Date(lundi.getTime() + 6 * 86400000);
  const debut = lundi.getUTCMonth() === dimanche.getUTCMonth()
    ? `${lundi.getUTCDate()}`
    : `${lundi.getUTCDate()} ${MOIS[lundi.getUTCMonth()]}`;
  return `Comoresnews — l'essentiel de la semaine du ${debut} au ${dimanche.getUTCDate()} ${MOIS[dimanche.getUTCMonth()]}`;
}

// Articles publiés depuis la dernière newsletter envoyée (sinon 7 derniers jours), plus récents d'abord.
export function pickArticles(rows, sinceIso, now) {
  const since = sinceIso ? new Date(sinceIso).getTime() : now.getTime() - 7 * 86400000;
  return (rows || [])
    .filter((r) => r.statut === 'publie' && r.date_publication && new Date(r.date_publication).getTime() > since)
    .sort((a, b) => new Date(b.date_publication) - new Date(a.date_publication));
}

function lienArticle(a, siteUrl) {
  return `${siteUrl.replace(/\/$/, '')}/${articleUrl(String(a.date_publication).slice(0, 10), a.slug)}`;
}
function image(a, siteUrl) {
  const src = a.image_couverture;
  if (!src) return '';
  return isHttp(src) ? src : `${siteUrl.replace(/\/$/, '')}/${String(src).replace(/^\//, '')}`;
}

export function renderNewsletter({ objet, intro, articles, siteUrl, unsubscribeUrl, categories = {} }) {
  const introTxt = String(intro || '').trim();
  const blocs = (articles || []).map((a) => {
    const url = lienArticle(a, siteUrl);
    const img = image(a, siteUrl);
    const cat = categories[a.categorie] || '';
    return `<tr><td style="padding:0 24px 28px">
  ${img ? `<a href="${esc(url)}"><img src="${esc(img)}" alt="" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:4px"></a>` : ''}
  ${cat ? `<p style="margin:12px 0 4px;font:700 11px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#e50914">${esc(cat)}</p>` : ''}
  <h2 style="margin:${cat ? 0 : '12px'} 0 6px;font:700 20px/1.3 Arial,sans-serif"><a href="${esc(url)}" style="color:#111;text-decoration:none">${esc(a.titre)}</a></h2>
  ${a.excerpt ? `<p style="margin:0 0 10px;font:15px/1.5 Arial,sans-serif;color:#444">${esc(a.excerpt)}</p>` : ''}
  <a href="${esc(url)}" style="font:700 14px Arial,sans-serif;color:#19471a">Lire l'article →</a>
</td></tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(objet)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:6px;overflow:hidden">
<tr><td style="background:#111;padding:18px 24px;font:800 22px Arial,sans-serif;letter-spacing:.5px;color:#fff">COMORES<span style="color:#e50914">NEWS</span></td></tr>
<tr><td style="padding:22px 24px 8px;font:700 13px Arial,sans-serif;color:#777;text-transform:uppercase;letter-spacing:.06em">L'essentiel de la semaine</td></tr>
${introTxt ? `<tr><td style="padding:0 24px 22px"><p style="margin:0;font:16px/1.55 Arial,sans-serif;color:#222">${esc(introTxt).replace(/\n/g, '<br>')}</p></td></tr>` : ''}
${blocs}
<tr><td style="padding:18px 24px;background:#111;font:12px/1.6 Arial,sans-serif;color:#aaa">
Vous recevez cet email car vous êtes inscrit à la newsletter de <a href="${esc(siteUrl)}" style="color:#ddd">comoresnews.com</a>.<br>
<a href="${esc(unsubscribeUrl)}" style="color:#ddd">Se désinscrire</a>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    introTxt,
    ...(articles || []).map((a) => `${a.titre}\n${a.excerpt ? a.excerpt + '\n' : ''}${lienArticle(a, siteUrl)}`),
    `—\nVous recevez cet email car vous êtes inscrit à la newsletter de comoresnews.com.\nSe désinscrire : ${unsubscribeUrl}`,
  ].filter(Boolean).join('\n\n');

  return { html, text };
}
