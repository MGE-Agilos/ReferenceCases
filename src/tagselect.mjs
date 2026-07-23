// Reusable searchable multi-select with removable chips.
// Browser-only (DOM). Pure filtering logic lives in ./lib/tagselect-filter.mjs.
import { flattenOptions, filterOptions } from './lib/tagselect-filter.mjs';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// mountEl: container element. opts: { options, selected, placeholder }.
// options: flat ['a'] or grouped [{group,items:[...]}]. Returns { getSelected, setSelected, setOptions }.
export function createTagSelect(mountEl, { options = [], selected = [], placeholder = 'Search…' } = {}) {
  let flat = flattenOptions(options);
  let chosen = [...selected];
  let activeIndex = 0;

  mountEl.classList.add('tagselect');
  mountEl.innerHTML = `
    <div class="ts-control">
      <span class="ts-chips"></span>
      <input class="ts-input" type="text" placeholder="${esc(placeholder)}" autocomplete="off" />
    </div>
    <div class="ts-dropdown"></div>`;

  const control = mountEl.querySelector('.ts-control');
  const chipsEl = mountEl.querySelector('.ts-chips');
  const input = mountEl.querySelector('.ts-input');
  const dropdown = mountEl.querySelector('.ts-dropdown');

  function renderChips() {
    chipsEl.innerHTML = chosen.map((v, i) =>
      `<span class="ts-chip">${esc(v)}<button type="button" data-rm="${i}" aria-label="Remove">×</button></span>`
    ).join('');
    chipsEl.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => { chosen.splice(Number(b.dataset.rm), 1); renderChips(); renderDropdown(); }));
  }

  function currentMatches() {
    return filterOptions(flat, input.value, chosen);
  }

  function renderDropdown() {
    const matches = currentMatches();
    if (activeIndex >= matches.length) activeIndex = Math.max(0, matches.length - 1);
    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="ts-empty">No match</div>';
      return;
    }
    let html = '';
    let lastGroup = null;
    matches.forEach((m, i) => {
      if (m.group && m.group !== lastGroup) { html += `<div class="ts-group">${esc(m.group)}</div>`; lastGroup = m.group; }
      html += `<div class="ts-item${i === activeIndex ? ' active' : ''}" data-i="${i}">${esc(m.value)}</div>`;
    });
    dropdown.innerHTML = html;
    dropdown.querySelectorAll('[data-i]').forEach((el) =>
      el.addEventListener('mousedown', (e) => { e.preventDefault(); add(matches[Number(el.dataset.i)].value); }));
  }

  function open() { mountEl.classList.add('open'); renderDropdown(); }
  function close() { mountEl.classList.remove('open'); }

  function add(value) {
    if (!value || chosen.includes(value)) return;
    chosen.push(value);
    input.value = '';
    activeIndex = 0;
    renderChips();
    renderDropdown();
    input.focus();
  }

  input.addEventListener('focus', open);
  input.addEventListener('input', () => { activeIndex = 0; open(); });
  input.addEventListener('keydown', (e) => {
    const matches = currentMatches();
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); renderDropdown(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderDropdown(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[activeIndex]) add(matches[activeIndex].value); }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Backspace' && input.value === '' && chosen.length) { chosen.pop(); renderChips(); renderDropdown(); }
  });
  control.addEventListener('click', () => input.focus());
  document.addEventListener('click', (e) => { if (!mountEl.contains(e.target)) close(); });

  renderChips();

  return {
    getSelected: () => [...chosen],
    setSelected: (vals) => { chosen = [...(vals || [])]; renderChips(); renderDropdown(); },
    setOptions: (o) => { flat = flattenOptions(o); renderDropdown(); },
  };
}
