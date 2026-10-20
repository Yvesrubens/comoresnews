// Devine la catégorie Comoresnews à partir des libellés de la source (premier qui correspond).
const RULES = [
  [/politique/, 'politique'],
  [/econom|financ/, 'economie'],
  [/sport/, 'sport'],
  [/diaspora/, 'diaspora'],
  [/monde|international/, 'monde'],
  [/touris/, 'tourisme'],
  [/cultur/, 'culture'],
  [/societ/, 'societe'],
];

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function guessCategory(labels) {
  for (const label of labels || []) {
    const l = norm(label);
    for (const [re, slug] of RULES) if (re.test(l)) return slug;
  }
  return null;
}
