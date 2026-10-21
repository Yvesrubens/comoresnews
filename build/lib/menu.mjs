// Menu : entrée « ● En direct » + bouton jaune « Newsletter gratuite » (bureau et mobile).

const EN_DIRECT = 'index.php/pages/en-direct/index.html';
const ACCUEIL = /href="([^"]*)index\.html"><div class="tdb-menu-item-text">Accueil/;

const CSS = `<style id="cn-menu-css">
.cn-live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ecc71;margin-right:6px;vertical-align:middle;animation:cn-live 1.4s ease-in-out infinite}
@keyframes cn-live{50%{opacity:.25}}
#cn-menu-direct .tdb-menu-item-text{display:inline-flex;align-items:center}
@media (min-width:1019px){.tdb_header_menu{position:relative}.tdb_header_menu .cn-menu-nl{position:absolute;right:0;top:-54px}.tdb_header_menu .tdb-menu>li>a{padding:0 9px!important}}
a.cn-nl-btn{display:inline-block;background:#f5b400;color:#1b2a45!important;font-weight:700;border-radius:6px;padding:8px 14px;line-height:1.2;text-decoration:none;white-space:nowrap;text-transform:none!important;font-size:15px!important;letter-spacing:0}
a.cn-nl-btn:hover{background:#ffc61a}
.td-mobile-main-menu .cn-menu-nl a.cn-nl-btn{margin:8px 0;padding:10px 16px}
</style>`;

// Insère `items` juste avant le </ul> de la liste d'id `ulId`.
function beforeUlEnd(html, ulId, items) {
  const i = html.indexOf(`id="${ulId}"`);
  if (i < 0) return html;
  const j = html.indexOf('</ul>', i);
  return j < 0 ? html : html.slice(0, j) + items + html.slice(j);
}

export function injectMenu(html) {
  if (html.includes('id="cn-menu-direct"') || !html.includes('id="menu-main-3"')) return html;
  const m = ACCUEIL.exec(html);
  const P = m ? m[1] : '';
  const nl = html.includes('id="cn-newsletter"') ? '#cn-newsletter' : `${P}index.html#cn-newsletter`;
  const bouton = `<a class="cn-nl-btn" href="${nl}">Newsletter gratuite</a>`;
  html = beforeUlEnd(html, 'menu-main-3',
    `<li id="cn-menu-direct" class="menu-item tdb-menu-item-button tdb-menu-item tdb-normal-menu"><a href="${P}${EN_DIRECT}"><div class="tdb-menu-item-text"><span class="cn-live-dot"></span>En direct</div></a></li>`
    + `<li class="menu-item cn-menu-nl">${bouton}</li>\n`);
  html = beforeUlEnd(html, 'menu-main-2',
    `<li class="menu-item"><a href="${P}${EN_DIRECT}"><span class="cn-live-dot"></span>En direct</a></li>`
    + `<li class="menu-item cn-menu-nl">${bouton}</li>\n`);
  return html.replace('</head>', `${CSS}\n</head>`);
}
