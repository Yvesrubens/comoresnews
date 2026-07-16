import MarkdownIt from 'markdown-it';
import { articlePath } from './paths.mjs';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export function renderMarkdown(src) {
  return md.render(src || '');
}

export function articleCard(a, prefix, catName) {
  const url = prefix + articlePath(a.date, a.slug);
  const thumb = a.image
    ? `<img src="${prefix}${a.image}" alt="" width="108" height="74" loading="lazy" decoding="async" style="display:block;width:108px;height:74px;object-fit:cover;border-radius:3px;">`
    : `<span style="display:block;width:108px;height:74px;background:#dcdcdc;border-radius:3px;"></span>`;
  return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #eaeaea;align-items:flex-start;">
  <a href="${url}" style="flex:0 0 108px;text-decoration:none;">${thumb}</a>
  <div style="flex:1;min-width:0;">
    <span style="display:inline-block;background:#222;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;">${catName}</span>
    <h3 style="margin:7px 0 0;font-size:16px;line-height:1.35;font-weight:600;"><a href="${url}" style="color:#111;text-decoration:none;">${a.title}</a></h3>
  </div>
</div>`;
}
