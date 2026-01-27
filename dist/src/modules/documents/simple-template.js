function getByPath(obj, pathStr) {
    const parts = pathStr.split('.').map(p => p.trim()).filter(Boolean);
    let cur = obj;
    for (const p of parts) {
        if (cur == null)
            return '';
        cur = cur[p];
    }
    return cur ?? '';
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
/**
 * Minimal templating:
 * - `{{path}}` HTML-escapes values
 * - `{{{path}}}` injects raw HTML (trusted)
 */
export function renderTemplate(template, context) {
    // Raw first
    const rawRendered = template.replaceAll(/\{\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}\}/g, (_m, key) => {
        const v = getByPath(context, String(key));
        return v == null ? '' : String(v);
    });
    return rawRendered.replaceAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
        const v = getByPath(context, String(key));
        const s = v == null ? '' : String(v);
        return escapeHtml(s);
    });
}
