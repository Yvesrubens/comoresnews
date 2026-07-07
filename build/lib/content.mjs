import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const REQUIRED = ['title','slug','category','author','date','status'];

export function parseArticle(raw, validCats) {
  const { data, content } = matter(raw);
  for (const k of REQUIRED)
    if (!data[k]) throw new Error(`Champ requis manquant: ${k} (article ${data.slug || '?'})`);
  if (!validCats.includes(data.category))
    throw new Error(`Catégorie inconnue: ${data.category} (article ${data.slug})`);
  return {
    title: String(data.title),
    slug: String(data.slug),
    category: String(data.category),
    author: String(data.author),
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date).slice(0, 10),
    image: data.image ? String(data.image) : '',
    excerpt: data.excerpt ? String(data.excerpt) : '',
    status: String(data.status),
    body: content.trim(),
  };
}

export function isPublishable(a, nowISO) {
  if (a.status === 'published') return true;
  if (a.status === 'scheduled') return a.date <= nowISO;
  return false; // draft
}

export function loadArticles(dir, validCats) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => parseArticle(fs.readFileSync(path.join(dir, f), 'utf8'), validCats));
}
