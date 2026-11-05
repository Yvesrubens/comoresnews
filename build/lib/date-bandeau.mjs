// Date du bandeau du haut (toutes les pages) : figée à « dimanche, juillet 5, 2026 » dans
// le thème d'origine. On écrit la date du build, puis le navigateur l'actualise (heure des Comores).

const FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DATE_RE = /(<div class="tdb-head-date-txt">)[^<]*(<\/div>)/;

export function dateLongue(jour) {
  return FMT.format(new Date(jour + 'T12:00:00Z'));
}

const SCRIPT = `<script id="cn-date">(function(){try{var f=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Indian/Comoro'});document.querySelectorAll('.tdb-head-date-txt').forEach(function(e){e.textContent=f.format(new Date());});}catch(e){}})();</script>`;

export function injectDate(html, jour) {
  if (html.includes('id="cn-date"') || !DATE_RE.test(html)) return html;
  html = html.replace(DATE_RE, `$1${dateLongue(jour)}$2`);
  const i = html.lastIndexOf('</body>');
  return i < 0 ? html + SCRIPT : html.slice(0, i) + SCRIPT + html.slice(i);
}
