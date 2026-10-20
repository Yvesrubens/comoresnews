import { XMLParser } from 'fast-xml-parser';
import { htmlToText } from './html-text.mjs';

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true, htmlEntities: true });
const text = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// Lit un flux RSS 2.0 et renvoie les articles au format Item.
export function parseRss(xml, src) {
  const channel = parser.parse(xml)?.rss?.channel;
  return list(channel?.item).map((it) => {
    const d = new Date(text(it.pubDate));
    return {
      source: src.id,
      source_nom: src.nom,
      url: text(it.link).trim(),
      titre: htmlToText(text(it.title)),
      texte: htmlToText(text(it['content:encoded']) || text(it.description)),
      categorie_source: list(it.category).map(text).map((c) => c.trim()).filter(Boolean).join(' | '),
      date_source: Number.isNaN(d.getTime()) ? null : d.toISOString(),
    };
  }).filter((i) => /^https?:\/\//i.test(i.url) && i.titre);
}
