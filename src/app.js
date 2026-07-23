import { listCases, getCase, insertCase, updateCase } from './supabaseClient.mjs';
import { formatDuration, validateCase } from './lib/format.mjs';

const views = ['list', 'form', 'preview'];
export function showView(name) {
  for (const v of views) document.getElementById(`view-${v}`).classList.toggle('active', v === name);
}

async function renderList() {
  const el = document.getElementById('list-container');
  el.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const cases = await listCases();
    if (cases.length === 0) { el.innerHTML = '<p class="muted">No reference cases yet.</p>'; return; }
    el.innerHTML = '';
    for (const c of cases) {
      const client = c.client_confidential ? `Confidential (${c.client_sector || '—'})` : (c.client_name || '—');
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="row" style="align-items:center">
          <div style="flex:2">
            <strong>${escapeHtml(client)}</strong>
            <span class="badge ${c.status === 'generated' ? 'generated' : ''}">${c.status}</span>
            <div class="muted">${escapeHtml((c.consultants || []).join(', '))} · ${escapeHtml(formatDuration(c.duration_start, c.duration_end, c.is_ongoing))}</div>
          </div>
          <button class="btn secondary" data-open="${c.id}">Open</button>
        </div>`;
      el.appendChild(card);
    }
    el.querySelectorAll('[data-open]').forEach((b) =>
      b.addEventListener('click', () => openPreview(b.dataset.open)));
  } catch (e) {
    el.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
  }
}

// Placeholders wired fully in later tasks:
export async function openPreview(id) { window.__currentCase = await getCase(id); showView('preview'); renderPreview(); }
export function renderPreview() {} // Task 12
let REF_DATA = { consultants: [], sectors: [], technologies: {} };
let editingId = null;

async function loadRefData() {
  if (REF_DATA.consultants.length) return REF_DATA;
  REF_DATA = await (await fetch('./data/reference-data.json')).json();
  return REF_DATA;
}

function fillSelect(sel, values, selected = []) {
  sel.innerHTML = '';
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v; o.textContent = v; o.selected = selected.includes(v);
    sel.appendChild(o);
  }
}

function buildTechCheckboxes(selected = []) {
  const host = document.getElementById('f-tech');
  host.innerHTML = '';
  for (const [cat, techs] of Object.entries(REF_DATA.technologies)) {
    const block = document.createElement('div');
    block.className = 'tech-cat';
    block.innerHTML = `<strong>${escapeHtml(cat)}</strong><div class="checkgroup"></div>`;
    const group = block.querySelector('.checkgroup');
    for (const t of techs) {
      const id = `tech-${cat}-${t}`.replace(/[^a-z0-9]/gi, '-');
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(t)}" ${selected.includes(t) ? 'checked' : ''}> ${escapeHtml(t)}`;
      label.setAttribute('for', id);
      group.appendChild(label);
    }
    host.appendChild(block);
  }
}

function readForm() {
  const g = (id) => document.getElementById(id);
  const selected = (sel) => Array.from(sel.selectedOptions).map((o) => o.value);
  const techs = Array.from(document.querySelectorAll('#f-tech input:checked')).map((i) => i.value);
  return {
    consultants: selected(g('f-consultants')),
    client_name: g('f-client-name').value.trim(),
    client_confidential: g('f-confidential').checked,
    client_sector: g('f-sector').value,
    duration_start: g('f-start').value || null,
    duration_end: g('f-ongoing').checked ? null : (g('f-end').value || null),
    is_ongoing: g('f-ongoing').checked,
    technologies: techs,
    role: g('f-role').value.trim(),
    team_size: g('f-team').value ? Number(g('f-team').value) : null,
    context_challenge: g('f-context').value.trim(),
    solution: g('f-solution').value.trim(),
    results: g('f-results').value.trim(),
    testimonial: g('f-testimonial').value.trim() || null,
  };
}

function writeForm(rec = {}) {
  const g = (id) => document.getElementById(id);
  fillSelect(g('f-consultants'), REF_DATA.consultants, rec.consultants || []);
  fillSelect(g('f-sector'), ['', ...REF_DATA.sectors], []);
  g('f-sector').value = rec.client_sector || '';
  g('f-client-name').value = rec.client_name || '';
  g('f-confidential').checked = !!rec.client_confidential;
  g('f-start').value = rec.duration_start || '';
  g('f-end').value = rec.duration_end || '';
  g('f-ongoing').checked = !!rec.is_ongoing;
  g('f-role').value = rec.role || '';
  g('f-team').value = rec.team_size ?? '';
  g('f-context').value = rec.context_challenge || '';
  g('f-solution').value = rec.solution || '';
  g('f-results').value = rec.results || '';
  g('f-testimonial').value = rec.testimonial || '';
  buildTechCheckboxes(rec.technologies || []);
}

export async function openForm(rec = null) {
  await loadRefData();
  editingId = rec?.id || null;
  document.getElementById('form-title').textContent = editingId ? 'Edit reference case' : 'New reference case';
  document.getElementById('form-errors').innerHTML = '';
  writeForm(rec || {});
  showView('form');
}

document.getElementById('case-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rec = readForm();
  const errors = validateCase(rec);
  const box = document.getElementById('form-errors');
  if (errors.length) { box.innerHTML = errors.map((x) => `<div class="error">• ${escapeHtml(x)}</div>`).join(''); return; }
  box.innerHTML = '';
  try {
    const saved = editingId ? await updateCase(editingId, rec) : await insertCase(rec);
    window.__currentCase = saved;
    showView('preview'); renderPreview();
  } catch (err) {
    box.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
  }
});

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('nav-new').addEventListener('click', () => openForm());
document.getElementById('form-cancel').addEventListener('click', () => { showView('list'); renderList(); });
document.getElementById('pv-back').addEventListener('click', () => { showView('list'); renderList(); });

renderList();
