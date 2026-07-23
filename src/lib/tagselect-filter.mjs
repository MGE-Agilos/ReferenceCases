// Pure helpers for the tag-select component (unit-tested).

// Strip diacritics + lowercase, so "andre" matches "André".
export function normalize(s) {
  return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// options may be flat (['a','b']) or grouped ([{group:'G', items:['a','b']}]).
// Returns a flat list of { value, group } (group is '' when flat).
export function flattenOptions(options) {
  if (!Array.isArray(options)) return [];
  if (options.length && typeof options[0] === 'object' && options[0] !== null && 'items' in options[0]) {
    return options.flatMap((g) => (g.items || []).map((value) => ({ value, group: g.group || '' })));
  }
  return options.map((value) => ({ value, group: '' }));
}

// Keep options not already selected and whose value matches the query.
export function filterOptions(flat, query, selected = []) {
  const sel = new Set(selected);
  const q = normalize(query);
  return flat.filter((o) => !sel.has(o.value) && (!q || normalize(o.value).includes(q)));
}
