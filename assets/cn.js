(function () {
  var b = document.body;
  var burger = document.querySelector('.cn-burger');
  if (burger) burger.addEventListener('click', function () { b.classList.toggle('cn-menu-ouvert'); });

  var items = document.querySelectorAll('.cn-ticker-item');
  if (items.length < 1) return;
  var i = 0, timer = null;
  function montre(n) {
    items[i].classList.remove('actif');
    i = (n + items.length) % items.length;
    items[i].classList.add('actif');
  }
  function relance() {
    clearInterval(timer);
    if (items.length > 1) timer = setInterval(function () { montre(i + 1); }, 5000);
  }
  var prec = document.querySelector('.cn-ticker-prec'), suiv = document.querySelector('.cn-ticker-suiv');
  if (prec) prec.addEventListener('click', function () { montre(i - 1); relance(); });
  if (suiv) suiv.addEventListener('click', function () { montre(i + 1); relance(); });
  relance();
})();
