import { listCases, getCase } from './supabaseClient.mjs';
import { formatDuration } from './lib/format.mjs';

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
export function openForm() {}       // Task 10

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('nav-new').addEventListener('click', () => openForm());
document.getElementById('form-cancel').addEventListener('click', () => { showView('list'); renderList(); });
document.getElementById('pv-back').addEventListener('click', () => { showView('list'); renderList(); });

renderList();
