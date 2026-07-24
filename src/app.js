import { listCases, getCase, insertCase, updateCase } from './supabaseClient.mjs';
import { formatDuration, validateCase } from './lib/format.mjs';
import { mdToHtml } from './lib/markdown.mjs';
import { exportPdf, exportWord } from './export.mjs';
import { createTagSelect } from './tagselect.mjs';

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
export function renderPreview() {
  const c = window.__currentCase;
  const el = document.getElementById('preview-content');
  const status = document.getElementById('pv-status');
  const hasText = !!c?.generated_markdown;
  document.getElementById('pv-pdf').disabled = !hasText;
  document.getElementById('pv-word').disabled = !hasText;
  status.textContent = c?.status === 'generated' ? 'Generated. Review, then export.' : 'Draft — click "Generate with AI".';
  el.innerHTML = hasText
    ? mdToHtml(c.generated_markdown)
    : '<p class="muted">No generated text yet.</p>';
}
let REF_DATA = { consultants: [], sectors: [], technologies: {} };
let editingId = null;
let consultantTS = null;
let techTS = null;

function techGroups() {
  return Object.entries(REF_DATA.technologies).map(([group, items]) => ({ group, items }));
}

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

function readForm() {
  const g = (id) => document.getElementById(id);
  return {
    consultants: consultantTS ? consultantTS.getSelected() : [],
    client_name: g('f-client-name').value.trim(),
    client_confidential: g('f-confidential').checked,
    client_sector: g('f-sector').value,
    language: g('f-language').value || 'en',
    duration_start: g('f-start').value || null,
    duration_end: g('f-ongoing').checked ? null : (g('f-end').value || null),
    is_ongoing: g('f-ongoing').checked,
    technologies: techTS ? techTS.getSelected() : [],
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
  fillSelect(g('f-sector'), ['', ...REF_DATA.sectors], []);
  g('f-sector').value = rec.client_sector || '';
  g('f-language').value = rec.language || 'en';
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

  if (!consultantTS) {
    consultantTS = createTagSelect(g('f-consultants'), {
      options: REF_DATA.consultants, selected: rec.consultants || [], placeholder: 'Search a consultant…',
    });
  } else {
    consultantTS.setOptions(REF_DATA.consultants);
    consultantTS.setSelected(rec.consultants || []);
  }
  if (!techTS) {
    techTS = createTagSelect(g('f-tech'), {
      options: techGroups(), selected: rec.technologies || [], placeholder: 'Search a technology…',
    });
  } else {
    techTS.setOptions(techGroups());
    techTS.setSelected(rec.technologies || []);
  }
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

function fileBase(c) {
  const who = c.client_confidential ? (c.client_sector || 'confidential') : (c.client_name || 'client');
  return `reference-case-${who}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

document.getElementById('pv-generate').addEventListener('click', async () => {
  const c = window.__currentCase;
  const status = document.getElementById('pv-status');
  const btn = document.getElementById('pv-generate');
  btn.disabled = true; status.textContent = 'Generating… (calling Claude)';
  try {
    const res = await fetch(window.APP_CONFIG.FUNCTION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    window.__currentCase = { ...c, generated_markdown: data.markdown, status: 'generated' };
    renderPreview();
  } catch (e) {
    status.textContent = '';
    document.getElementById('preview-content').innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
  } finally { btn.disabled = false; }
});

document.getElementById('pv-pdf').addEventListener('click', () =>
  exportPdf(document.getElementById('preview-content'), `${fileBase(window.__currentCase)}.pdf`));
document.getElementById('pv-word').addEventListener('click', () =>
  exportWord(window.__currentCase.generated_markdown, `${fileBase(window.__currentCase)}.docx`));

document.getElementById('pv-back').insertAdjacentHTML('afterend',
  '<button id="pv-edit" class="btn secondary">Edit fields</button>');
document.getElementById('pv-edit').addEventListener('click', () => openForm(window.__currentCase));

renderList();
