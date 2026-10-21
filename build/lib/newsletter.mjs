// Bandeau d'inscription à la newsletter (site public).
// L'email est envoyé à la fonction Supabase `inscrire_newsletter` avec la clé
// publique (anon) : le site ne peut qu'inscrire, jamais lire la liste.

// Valeurs publiques (déjà présentes dans le back-office), surchargeables par env.
export const SUPABASE_PUBLIC = {
  url: process.env.SUPABASE_URL || 'https://flednhvntwyxirepijyn.supabase.co',
  anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZWRuaHZudHd5eGlyZXBpanluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDgwMzcsImV4cCI6MjEwMTUyNDAzN30.eIyZ5mrJSeOntlyYqux_DyEr4BfRYZg04jTpquXUobQ',
};

const ANCHOR = '<div class="td-main-content-wrap';
const PRIVACY = '/index.php/pages/politique-confidentialite/index.html';

export function newsletterBand(cfg = SUPABASE_PUBLIC) {
  return `<section id="cn-newsletter" class="cn-nl">
<style>
.cn-nl{background:#1b1f27;color:#c9ced8;font-family:'Roboto',Arial,sans-serif;padding:18px 15px;}
.cn-nl-in{max-width:1068px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}
.cn-nl-t{font-size:17px;font-weight:700;color:#fff;margin:0;}
.cn-nl-t span{color:#e50914;}
.cn-nl-s{font-size:13px;margin:2px 0 0;}
.cn-nl-f{flex:1 1 420px;max-width:560px;}
.cn-nl-row{display:flex;gap:10px;}
.cn-nl-row input[type=email]{flex:1;min-width:0;background:#11141a;border:1px solid #3a3f4a;border-radius:6px;color:#fff;padding:11px 14px;font-size:15px;}
.cn-nl-row button{background:#e50914;color:#fff;border:0;border-radius:6px;padding:0 20px;font-size:15px;font-weight:700;cursor:pointer;}
.cn-nl-row button:disabled{opacity:.6;cursor:default;}
.cn-nl-c{font-size:12px;line-height:1.5;margin:8px 0 0;color:#9aa1ad;}
.cn-nl-c a{color:#c9ced8;}
.cn-nl-msg{font-size:13px;margin:8px 0 0;font-weight:600;}
.cn-nl-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}
@media(max-width:600px){.cn-nl-row{flex-direction:column;}.cn-nl-row button{padding:11px;}}
</style>
<div class="cn-nl-in">
  <div>
    <p class="cn-nl-t"><span>Recevez l'actualité des Comores</span> dans votre boîte mail</p>
    <p class="cn-nl-s">Chaque vendredi, les articles de la semaine.</p>
  </div>
  <form class="cn-nl-f" novalidate>
    <div class="cn-nl-row">
      <input type="email" name="email" placeholder="votre@email.com" required autocomplete="email" aria-label="Votre adresse email">
      <button type="submit">S'abonner</button>
    </div>
    <div class="cn-nl-hp" aria-hidden="true"><label>Ne pas remplir <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <p class="cn-nl-c">En vous inscrivant, vous acceptez de recevoir notre newsletter. Désinscription possible à tout moment. <a href="${PRIVACY}">Politique de confidentialité</a></p>
    <p class="cn-nl-msg" role="status" aria-live="polite"></p>
  </form>
</div>
<script>(function(){
var f=document.querySelector('#cn-newsletter form'); if(!f) return;
var m=f.querySelector('.cn-nl-msg'), b=f.querySelector('button');
f.addEventListener('submit',function(e){
  e.preventDefault();
  if(f.website.value) return; // robot
  var email=(f.email.value||'').trim();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){ m.style.color='#ff6b6b'; m.textContent='Adresse email invalide.'; return; }
  b.disabled=true; m.style.color='#c9ced8'; m.textContent='Inscription…';
  fetch('${cfg.url}/rest/v1/rpc/inscrire_newsletter',{method:'POST',headers:{'Content-Type':'application/json',apikey:'${cfg.anonKey}',Authorization:'Bearer ${cfg.anonKey}'},
    body:JSON.stringify({p_email:email,p_source:location.pathname})})
  .then(function(r){ if(!r.ok) throw new Error(); m.style.color='#5bd38a'; m.textContent='Merci ! Vous êtes inscrit à la newsletter.'; f.email.value=''; })
  .catch(function(){ m.style.color='#ff6b6b'; m.textContent='Inscription impossible pour le moment, réessayez plus tard.'; })
  .then(function(){ b.disabled=false; });
});
})();</script>
</section>`;
}

// Insère le bandeau juste avant le contenu (sous le menu du site). Idempotent.
export function injectNewsletter(html, cfg = SUPABASE_PUBLIC) {
  if (html.includes('id="cn-newsletter"') || !html.includes(ANCHOR)) return html;
  const i = html.indexOf(ANCHOR);
  return html.slice(0, i) + newsletterBand(cfg) + '\n' + html.slice(i);
}
