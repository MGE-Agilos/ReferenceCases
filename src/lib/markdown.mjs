function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^- /.test(line)) { (list ||= []).push(`<li>${inline(line.slice(2))}</li>`); continue; }
    closeList();
    if (!line.trim()) continue;
    if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}
