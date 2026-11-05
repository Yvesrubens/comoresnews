// Intégration régie publicitaire SmartAdServer (format "OneCall").
// Config fournie par la régie (Comoresnews_AF).
export const SAS = {
  tag: 'https://ced.sascdn.com/tag/2136/smart.js',
  networkid: 2136,
  domain: 'https://www3.smartadserver.com',
  siteId: 778464,
  pageId: 2217296,
  // Tous les formats déclarés en un seul appel (onecall)
  formats: [
    { id: 45656, name: 'MegaBanniere 1 728x90' },
    { id: 49046, name: 'MegaBanniere 2 728x90' },
    { id: 45655, name: 'Pave 1 300x250' },
    { id: 49048, name: 'Pave 2 300x250' },
    { id: 45654, name: 'GrandAngle 300x600' },
    { id: 94320, name: 'Floor Ad 728x90' },
  ],
};

// Bloc <head> : chargement de la lib + setup + onecall (une fois par page).
export function adsSetup(cfg = SAS) {
  const formats = cfg.formats.map((f) => `{ id: ${f.id} }`).join(', ');
  return `<script type="application/javascript" src="${cfg.tag}" async></script>
<script type="application/javascript">
var sas = sas || {}; sas.cmd = sas.cmd || [];
sas.cmd.push(function () {
  sas.setup({ networkid: ${cfg.networkid}, domain: "${cfg.domain}", async: true });
  sas.call("onecall", { siteId: ${cfg.siteId}, pageId: ${cfg.pageId}, formats: [${formats}], target: '' });
});
</script>`;
}

// Un emplacement : conteneur + appel render.
export function adSlot(id) {
  return `<div id="sas_${id}"></div><script type="application/javascript">sas.cmd.push(function(){sas.render("${id}");});</script>`;
}

function labeled(cls, inner) {
  // cn-ad--empty = masqué par défaut ; révélé par le script quand une créa charge.
  return `<div class="cn-ad cn-ad--empty ${cls}"><span class="cn-ad-tag">Publicité</span>${inner}</div>`;
}

export const AD_CSS = `<style id="cn-ads-css">
.cn-ad{position:relative;display:flex;justify-content:center;margin:18px auto;padding-top:13px;max-width:100%;overflow:hidden;}
.cn-ad--empty{display:none!important;}
.cn-ad-tag{position:absolute;top:0;left:50%;transform:translateX(-50%);font:600 9px/1.4 system-ui,sans-serif;letter-spacing:.09em;color:#b3b3b3;text-transform:uppercase;}
.cn-ad-strip{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:22px;margin:18px auto;}
.cn-ad-strip .cn-ad{margin:0;}
.cn-ad-rail{position:fixed;right:14px;top:120px;z-index:900;margin:0;}
.cn-ad-floor{position:fixed;left:0;right:0;bottom:0;z-index:9998;margin:0;background:rgba(255,255,255,.97);box-shadow:0 -2px 10px rgba(0,0,0,.12);padding:8px 0;}
.cn-ad-floor .cn-ad-close{position:absolute;right:10px;top:3px;border:none;background:rgba(0,0,0,.35);color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:14px;line-height:20px;padding:0;}
@media(max-width:1500px){.cn-ad-rail{display:none;}}
@media(max-width:768px){.cn-ad-desktop{display:none;}}
</style>`;

// Révèle un emplacement seulement si une vraie créa y est chargée (sinon reste masqué).
export const AD_REVEAL = `<script>(function(){
function filled(el){var s=el.querySelector('[id^="sas_"]');return s&&(s.querySelector('iframe,img,ins,a')||s.offsetHeight>10);}
function check(){document.querySelectorAll('.cn-ad--empty').forEach(function(el){if(filled(el))el.classList.remove('cn-ad--empty');});}
if(document.readyState!=='loading')check();else document.addEventListener('DOMContentLoaded',check);
var n=0,t=setInterval(function(){check();if(++n>=10)clearInterval(t);},1000);
})();</script>`;

// Insère une pub dans le corps d'un article, après le 2e paragraphe (ou le 1er
// s'il n'y en a qu'un). Ne fait rien hors des pages article.
export function insertInArticle(html, adHtml, afterParagraph = 2) {
  let start = html.indexOf('class="cn-article-body"');
  if (start === -1) return html;
  let pos = start;
  let found = -1;
  for (let i = 0; i < afterParagraph; i++) {
    const next = html.indexOf('</p>', pos);
    if (next === -1) break;
    found = next + 4;
    pos = found;
  }
  if (found === -1) return html;
  return html.slice(0, found) + '\n' + adHtml + '\n' + html.slice(found);
}

// Injecte la régie et les emplacements dans une page HTML complète.
// Idempotent : ne fait rien si des emplacements sont déjà présents.
export function injectAds(html, cfg = SAS) {
  if (/id="sas_/.test(html)) return html;
  html = html.replace('</head>', `${adsSetup(cfg)}\n${AD_CSS}\n</head>`);

  // MegaBanniere 1 : à la place de cn-ad-top, sinon en tête de main, sinon après <body>.
  const MAIN_OPEN = '<main id="cn-main">';
  if (html.includes('<div id="cn-ad-top"></div>')) {
    html = html.replace('<div id="cn-ad-top"></div>', () => labeled('cn-ad-desktop', adSlot(45656)));
  } else if (html.includes(MAIN_OPEN)) {
    html = html.replace(MAIN_OPEN, () => `${MAIN_OPEN}\n${labeled('cn-ad-desktop', adSlot(45656))}`);
  } else {
    html = html.replace(/(<body[^>]*>)/i, `$1\n${labeled('cn-ad-desktop', adSlot(45656))}`);
  }

  let gaPlaced = false;
  let p1Placed = false;

  // GrandAngle puis Pavé 1 dans la colonne de droite, sous « Suivez-nous ».
  const SIDEBAR_MARK = '<div id="cn-sidebar-ads"></div>';
  if (html.includes(SIDEBAR_MARK)) {
    html = html.replace(SIDEBAR_MARK, () => `<div id="cn-sidebar-ads">${labeled('', adSlot(45654))}${labeled('', adSlot(45655))}</div>`);
    gaPlaced = true;
    p1Placed = true;
  }

  // Bloc bas (avant le footer) : Pavé 2 + MegaBanniere 2, plus repli de ceux
  // qui n'ont pas trouvé leur ancre (pages sans la colonne de la home).
  const bottomParts = [];
  if (!gaPlaced) bottomParts.push(labeled('', adSlot(45654)));
  if (!p1Placed) bottomParts.push(labeled('', adSlot(45655)));
  bottomParts.push(labeled('cn-ad-desktop', adSlot(49046))); // MegaBanniere 2

  // Pavé 2 : uniquement dans le corps des articles (après le 2e paragraphe).
  html = insertInArticle(html, labeled('', adSlot(49048)));
  const bottom = bottomParts.join('\n');
  if (html.includes('id="cn-legal-bar"')) {
    html = html.replace('<div id="cn-legal-bar"', `${bottom}\n<div id="cn-legal-bar"`);
  } else {
    html = html.replace('</body>', `${bottom}\n</body>`);
  }

  // Floor fixe (overlay bas d'écran) + script de révélation.
  const floor = `<div class="cn-ad cn-ad--empty cn-ad-floor"><button class="cn-ad-close" aria-label="Fermer" onclick="this.parentNode.style.display='none'">&times;</button><span class="cn-ad-tag">Publicité</span>${adSlot(94320)}</div>`;
  html = html.replace('</body>', `${floor}\n${AD_REVEAL}\n</body>`);
  return html;
}
