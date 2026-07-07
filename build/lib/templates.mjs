export function applyTemplate(tpl, vars) {
  return tpl.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}
export function replaceSection(html, slug, inner) {
  return html.split(`{{SECTION:${slug}}}`).join(inner);
}
