# Reference Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal web app where Agilos consultants document reference cases via a structured form, then have Claude write a polished English reference case, exportable to PDF and Word.

**Architecture:** Static front-end (vanilla HTML/CSS/ES modules, no build) deployed to GitHub Pages via Actions on `MGE-Agilos/ReferenceCases`. Reference cases are stored in Supabase (schema `refcases`). A Supabase Edge Function (`generate-case`) holds the Claude API key server-side and generates the write-up. PDF/Word export runs in the browser. Pure logic (data transforms, formatting, prompt building) lives in small ES modules covered by `node --test`; UI and integration are verified manually with precise steps.

**Tech Stack:** Vanilla JS (ES modules), Node 22 built-in test runner (`node:test`), SheetJS (`xlsx`) for the one-off reference-data build, Supabase (Postgres + Edge Functions/Deno), Claude Messages API (`claude-sonnet-5`), `docx` + `html2pdf.js` (via CDN) for exports, GitHub Actions for deploy.

---

## File Structure

```
Reference Cases/
├── package.json                         # type:module, test + build scripts, xlsx devDep
├── .gitignore                           # (exists) ignores .env, node_modules, xlsx
├── scripts/
│   └── build-reference-data.mjs         # reads xlsx -> writes src/data/reference-data.json
├── src/
│   ├── index.html                       # single-page shell (list / form / preview views)
│   ├── styles.css                       # Beyond Data theme
│   ├── config.js                        # SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTION_URL (public)
│   ├── app.js                           # UI controller: routing between views, wiring
│   ├── supabaseClient.mjs               # thin Supabase REST wrapper (list/get/insert/update)
│   ├── export.mjs                       # markdown -> docx + markdown -> pdf (browser)
│   ├── data/
│   │   └── reference-data.json          # generated: consultants, sectors, technologies
│   └── lib/
│       ├── reference-data.mjs           # pure buildReferenceData(rows)
│       ├── reference-data.test.mjs
│       ├── format.mjs                   # formatDuration, validateCase
│       ├── format.test.mjs
│       └── markdown.mjs                 # tiny markdown -> structured blocks parser
│           # markdown.test.mjs
├── supabase/
│   ├── schema.sql                       # schema refcases + table + RLS (run in dashboard)
│   └── functions/
│       ├── _shared/
│       │   ├── prompt.js                # pure buildMessages(record) (ESM, Deno + node)
│       │   └── prompt.test.mjs
│       └── generate-case/
│           └── index.ts                 # Edge Function: fetch record, call Claude, update
├── .github/workflows/deploy.yml         # deploy src/ to GitHub Pages
└── README.md
```

**Responsibilities**
- `lib/*.mjs` — pure, framework-free functions, fully unit-tested.
- `supabaseClient.mjs` — the only place that talks to Supabase REST.
- `export.mjs` — the only place that touches `docx`/`html2pdf` globals.
- `app.js` — orchestration/DOM only; delegates logic to `lib/`.
- Edge Function `_shared/prompt.js` — canonical prompt, importable by both Deno and `node --test`.

---

## Task 1: Project scaffold + test runner

**Files:**
- Create: `package.json`
- Create: `src/lib/smoke.test.mjs` (temporary sanity test, deleted in Step 5)

- [ ] **Step 1: Write a failing smoke test**

`src/lib/smoke.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Create package.json**

`package.json`:
```json
{
  "name": "reference-cases",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build:refdata": "node scripts/build-reference-data.mjs"
  },
  "devDependencies": {
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 3: Install devDependencies and run the test**

Run: `npm install && npm test`
Expected: PASS — `tests 1 ... pass 1`.

- [ ] **Step 4: Delete the smoke test**

Run: `rm src/lib/smoke.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: project scaffold + node test runner"
```

---

## Task 2: Reference-data transform (pure)

Turns the raw matrix rows into `{ consultants, sectors, technologies }`. The matrix layout:
row index 0 = category row (category label appears in the first column of its group and spans right), row index 1 = technology labels, column 1 = consultant name, consultant data starts at row index 7. Sectors and consultants are derived from the header/name column; technologies are grouped by their category.

**Files:**
- Create: `src/lib/reference-data.mjs`
- Test: `src/lib/reference-data.test.mjs`

- [ ] **Step 1: Write the failing test**

`src/lib/reference-data.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReferenceData } from './reference-data.mjs';

// Minimal fixture mirroring the real sheet shape.
// rows[0] = category row, rows[1] = tech labels, rows[7+] = consultants.
// Column 1 = consultant name; tech columns start at index 5.
function makeRows() {
  const cat = Array(9).fill(null);
  cat[5] = 'Qlik'; cat[7] = 'Sector';       // category starts, spans until next non-null
  const tech = Array(9).fill(null);
  tech[5] = 'Qlik Data Modeling';
  tech[6] = 'Qlik Sense Designer';
  tech[7] = 'Banking';
  tech[8] = 'Public';
  const empty = Array(9).fill(null);
  const c1 = Array(9).fill(null); c1[1] = 'Alice Consultant';
  const c2 = Array(9).fill(null); c2[1] = 'Bob Builder';
  const total = Array(9).fill(null); total[1] = 'TOTAL';
  return [
    cat, tech, empty, empty, empty, empty, empty, // rows 0..6
    c1, c2, empty, total,                          // rows 7..10
  ];
}

test('extracts consultants, skipping blanks and TOTAL', () => {
  const data = buildReferenceData(makeRows());
  assert.deepEqual(data.consultants, ['Alice Consultant', 'Bob Builder']);
});

test('groups technologies by category', () => {
  const data = buildReferenceData(makeRows());
  assert.deepEqual(data.technologies['Qlik'], ['Qlik Data Modeling', 'Qlik Sense Designer']);
});

test('extracts sectors as a flat list', () => {
  const data = buildReferenceData(makeRows());
  assert.deepEqual(data.sectors, ['Banking', 'Public']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/reference-data.test.mjs`
Expected: FAIL — `buildReferenceData is not a function` / module not found.

- [ ] **Step 3: Implement `buildReferenceData`**

`src/lib/reference-data.mjs`:
```javascript
// Column layout constants (0-indexed) matching Competence Matrix "Feuil1".
const CATEGORY_ROW = 0;
const TECH_ROW = 1;
const CONSULTANT_START_ROW = 7;
const NAME_COL = 1;
const FIRST_TECH_COL = 5;
// Categories that are not real technologies (kept out of the tech picker).
const NON_TECH_CATEGORIES = new Set([
  'Sector', 'Principles', 'Dutch', 'French', 'English', 'German', 'Others',
]);

export function buildReferenceData(rows) {
  const categoryRow = rows[CATEGORY_ROW] || [];
  const techRow = rows[TECH_ROW] || [];

  // Forward-fill category labels across their column span.
  const colCategory = [];
  let current = '';
  for (let col = FIRST_TECH_COL; col < techRow.length; col++) {
    if (categoryRow[col]) current = String(categoryRow[col]).trim();
    colCategory[col] = current;
  }

  const technologies = {};
  const sectors = [];
  for (let col = FIRST_TECH_COL; col < techRow.length; col++) {
    const label = techRow[col];
    if (!label) continue;
    const category = colCategory[col];
    const name = String(label).trim();
    if (category === 'Sector') {
      sectors.push(name);
    } else if (!NON_TECH_CATEGORIES.has(category)) {
      (technologies[category] ||= []).push(name);
    }
  }

  const consultants = [];
  for (let r = CONSULTANT_START_ROW; r < rows.length; r++) {
    const raw = rows[r]?.[NAME_COL];
    if (!raw) continue;
    const name = String(raw).trim();
    if (!name || name.toUpperCase() === 'TOTAL') continue;
    consultants.push(name);
  }

  return { consultants, sectors, technologies };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/reference-data.test.mjs`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reference-data.mjs src/lib/reference-data.test.mjs
git commit -m "feat: reference-data transform from matrix rows"
```

---

## Task 3: Build script — generate `reference-data.json`

Reads the real xlsx and writes the committed JSON the front consumes.

**Files:**
- Create: `scripts/build-reference-data.mjs`
- Generates: `src/data/reference-data.json`

- [ ] **Step 1: Write the build script**

`scripts/build-reference-data.mjs`:
```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import { buildReferenceData } from '../src/lib/reference-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = resolve(__dirname, '../Competence martix.xlsx');
const OUT_PATH = resolve(__dirname, '../src/data/reference-data.json');

const wb = xlsx.read(readFileSync(XLSX_PATH), { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
// header:1 => array-of-arrays, defval:null keeps column alignment.
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

const data = buildReferenceData(rows);
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
console.log(
  `Wrote ${OUT_PATH}: ${data.consultants.length} consultants, ` +
  `${data.sectors.length} sectors, ${Object.keys(data.technologies).length} tech categories.`
);
```

- [ ] **Step 2: Run the build script**

Run: `npm run build:refdata`
Expected: prints e.g. `Wrote .../reference-data.json: 27 consultants, 10 sectors, 8 tech categories.` and `src/data/reference-data.json` exists.

> Note: `Competence martix.xlsx` may be a OneDrive cloud placeholder. If the script throws `EACCES`/permission-denied, open the file once in Excel (or right-click → "Always keep on this device") so it is materialised locally, then re-run.

- [ ] **Step 3: Sanity-check the output**

Run: `node -e "const d=require('./src/data/reference-data.json'); console.log(d.consultants.slice(0,3), d.sectors, Object.keys(d.technologies))"`
Expected: real consultant names (e.g. `Alexandre Roland`, `André Pato`), sector list (`Banking`, `Public`, …), and tech categories (`Qlik`, `Talend`, `Snowflake`, …).

- [ ] **Step 4: Commit**

```bash
git add scripts/build-reference-data.mjs src/data/reference-data.json
git commit -m "feat: build reference-data.json from Competence Matrix"
```

---

## Task 4: Formatting + validation lib (pure)

**Files:**
- Create: `src/lib/format.mjs`
- Test: `src/lib/format.test.mjs`

- [ ] **Step 1: Write the failing test**

`src/lib/format.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, validateCase } from './format.mjs';

test('formatDuration: same-year range', () => {
  assert.equal(formatDuration('2024-01', '2024-06', false), 'Jan 2024 – Jun 2024 (6 months)');
});

test('formatDuration: single month is 1 month', () => {
  assert.equal(formatDuration('2024-03', '2024-03', false), 'Mar 2024 (1 month)');
});

test('formatDuration: ongoing ignores end', () => {
  assert.equal(formatDuration('2023-11', null, true), 'Nov 2023 – ongoing');
});

test('validateCase: passes on a complete record', () => {
  const rec = {
    consultants: ['Alice'], client_name: 'ACME', client_sector: 'Banking',
    duration_start: '2024-01', duration_end: '2024-06', is_ongoing: false,
    technologies: ['Qlik Sense Designer'], role: 'Lead Dev', team_size: 3,
    context_challenge: 'x', solution: 'y', results: 'z',
  };
  assert.deepEqual(validateCase(rec), []);
});

test('validateCase: reports each missing required field', () => {
  const errors = validateCase({ consultants: [], client_name: '', technologies: [] });
  assert.ok(errors.includes('At least one consultant is required'));
  assert.ok(errors.includes('Client name is required'));
  assert.ok(errors.includes('At least one technology is required'));
  assert.ok(errors.includes('Business context/challenge is required'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/format.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `format.mjs`**

`src/lib/format.mjs`:
```javascript
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function label(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function monthsBetween(startYm, endYm) {
  const [ys, ms] = startYm.split('-').map(Number);
  const [ye, me] = endYm.split('-').map(Number);
  return (ye - ys) * 12 + (me - ms) + 1; // inclusive
}

export function formatDuration(start, end, ongoing) {
  if (!start) return '';
  if (ongoing) return `${label(start)} – ongoing`;
  if (!end || end === start) {
    const n = end ? monthsBetween(start, end) : 1;
    return `${label(start)} (${n} month${n > 1 ? 's' : ''})`;
  }
  const n = monthsBetween(start, end);
  return `${label(start)} – ${label(end)} (${n} month${n > 1 ? 's' : ''})`;
}

export function validateCase(rec) {
  const errors = [];
  if (!rec.consultants || rec.consultants.length === 0) errors.push('At least one consultant is required');
  if (!rec.client_name || !rec.client_name.trim()) errors.push('Client name is required');
  if (!rec.client_sector) errors.push('Client sector is required');
  if (!rec.duration_start) errors.push('Start month is required');
  if (!rec.is_ongoing && !rec.duration_end) errors.push('End month is required (or mark as ongoing)');
  if (!rec.technologies || rec.technologies.length === 0) errors.push('At least one technology is required');
  if (!rec.context_challenge || !rec.context_challenge.trim()) errors.push('Business context/challenge is required');
  if (!rec.solution || !rec.solution.trim()) errors.push('Solution description is required');
  if (!rec.results || !rec.results.trim()) errors.push('Results/value delivered is required');
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/format.test.mjs`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.mjs src/lib/format.test.mjs
git commit -m "feat: duration formatting + case validation"
```

---

## Task 5: Prompt builder (shared, pure)

Canonical Claude message builder used by the Edge Function; plain ESM `.js` so both Deno and `node --test` import it.

**Files:**
- Create: `supabase/functions/_shared/prompt.js`
- Test: `supabase/functions/_shared/prompt.test.mjs`

- [ ] **Step 1: Write the failing test**

`supabase/functions/_shared/prompt.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages } from './prompt.js';

const baseRecord = {
  consultants: ['Alice Consultant'], client_name: 'ACME Bank',
  client_confidential: false, client_sector: 'Banking',
  duration_start: '2024-01', duration_end: '2024-06', is_ongoing: false,
  technologies: ['Qlik Sense Designer', 'Snowflake'], role: 'Lead BI Consultant',
  team_size: 3, context_challenge: 'Slow reporting.', solution: 'Built a Qlik app.',
  results: 'Reports 10x faster.', testimonial: 'Great work.',
};

test('system prompt requests English + the required sections', () => {
  const { system } = buildMessages(baseRecord);
  assert.match(system, /English/);
  assert.match(system, /Client & Context/);
  assert.match(system, /Results/);
});

test('user message includes the real client name when not confidential', () => {
  const { messages } = buildMessages(baseRecord);
  assert.match(messages[0].content, /ACME Bank/);
});

test('confidential client name is withheld and anonymisation is requested', () => {
  const { system, messages } = buildMessages({ ...baseRecord, client_confidential: true });
  assert.doesNotMatch(messages[0].content, /ACME Bank/);
  assert.match(system, /anonymi/i);
  assert.match(messages[0].content, /Banking/); // sector still available for anonymised phrasing
});

test('returns model and max_tokens', () => {
  const out = buildMessages(baseRecord);
  assert.equal(out.model, 'claude-sonnet-5');
  assert.ok(out.max_tokens >= 1024);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test supabase/functions/_shared/prompt.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `prompt.js`**

`supabase/functions/_shared/prompt.js`:
```javascript
export const MODEL = 'claude-sonnet-5';
export const MAX_TOKENS = 2048;

const SECTIONS = [
  'Title', 'Client & Context', 'Challenge', 'Solution',
  'Technologies & Approach', 'Results / Value Delivered', 'Consultant Role',
];

export function buildMessages(rec) {
  const confidential = !!rec.client_confidential;
  const system = [
    'You are a professional B2B consulting copywriter for Agilos, a data & analytics consultancy.',
    'Write a polished, client-facing reference case in ENGLISH from the structured facts provided.',
    'Use a confident, factual, non-boastful tone. Do not invent facts, metrics, or client names not provided.',
    `Output GitHub-flavoured Markdown with exactly these sections as \`##\` headings, in order: ${SECTIONS.join(', ')}.`,
    'The Title section is a single \`#\` heading line (a short, compelling project title), not a \`##\` heading.',
    confidential
      ? 'The client is CONFIDENTIAL: never state the client name. Refer to them anonymously using the sector, e.g. "a leading player in the Banking sector".'
      : 'You may name the client.',
  ].join('\n');

  const facts = {
    consultants: rec.consultants,
    ...(confidential ? {} : { client_name: rec.client_name }),
    client_sector: rec.client_sector,
    duration: rec.is_ongoing
      ? `${rec.duration_start} to ongoing`
      : `${rec.duration_start} to ${rec.duration_end}`,
    technologies: rec.technologies,
    consultant_role: rec.role,
    team_size: rec.team_size,
    business_context_challenge: rec.context_challenge,
    solution_delivered: rec.solution,
    results_value: rec.results,
    client_testimonial: rec.testimonial || null,
  };

  const user =
    'Write the reference case from these facts (JSON). Omit any field that is null/empty.\n\n' +
    '```json\n' + JSON.stringify(facts, null, 2) + '\n```';

  return { model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content: user }] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test supabase/functions/_shared/prompt.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/prompt.js supabase/functions/_shared/prompt.test.mjs
git commit -m "feat: Claude prompt builder for reference cases"
```

---

## Task 6: Supabase schema + RLS

Creates schema `refcases`, the table, and RLS. Applied manually in the Supabase SQL editor (no CLI available).

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write `schema.sql`**

`supabase/schema.sql`:
```sql
create schema if not exists refcases;

create table if not exists refcases.reference_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consultants jsonb not null default '[]'::jsonb,
  client_name text not null default '',
  client_confidential boolean not null default false,
  client_sector text,
  duration_start text,
  duration_end text,
  is_ongoing boolean not null default false,
  technologies jsonb not null default '[]'::jsonb,
  role text,
  team_size integer,
  context_challenge text,
  solution text,
  results text,
  testimonial text,
  language text not null default 'en',
  status text not null default 'draft',
  generated_markdown text
);

-- keep updated_at fresh
create or replace function refcases.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_updated_at on refcases.reference_cases;
create trigger trg_touch_updated_at before update on refcases.reference_cases
  for each row execute function refcases.touch_updated_at();

-- RLS: internal tool, anon key may read/write; the Edge Function uses service_role (bypasses RLS).
alter table refcases.reference_cases enable row level security;

drop policy if exists anon_all on refcases.reference_cases;
create policy anon_all on refcases.reference_cases
  for all to anon using (true) with check (true);

-- Expose the schema to PostgREST (also add "refcases" under
-- Settings -> API -> Exposed schemas in the dashboard).
grant usage on schema refcases to anon, authenticated, service_role;
grant all on refcases.reference_cases to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply in Supabase (manual)**

1. Open the Supabase project → SQL Editor → paste the contents of `supabase/schema.sql` → Run.
2. Dashboard → Settings → API → **Exposed schemas**: add `refcases`, save.

Expected: table `refcases.reference_cases` visible in the Table Editor; no SQL errors.

- [ ] **Step 3: Verify REST access (manual)**

Run (replace placeholders; `-H "Accept-Profile: refcases"` selects the schema):
```bash
curl -s "$SUPABASE_URL/rest/v1/reference_cases?select=id" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Accept-Profile: refcases"
```
Expected: `[]` (empty array), not an error object.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: Supabase schema + table + RLS for reference cases"
```

---

## Task 7: Edge Function `generate-case`

Fetches the record by id (service role), builds messages, calls Claude, stores `generated_markdown`, sets `status='generated'`.

**Files:**
- Create: `supabase/functions/generate-case/index.ts`

- [ ] **Step 1: Write the Edge Function**

`supabase/functions/generate-case/index.ts`:
```typescript
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildMessages } from '../_shared/prompt.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { id } = await req.json();
    if (!id) return json({ error: 'Missing id' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'refcases' } },
    );

    const { data: rec, error } = await supabase
      .from('reference_cases').select('*').eq('id', id).single();
    if (error || !rec) return json({ error: 'Case not found' }, 404);

    const { model, max_tokens, system, messages } = buildMessages(rec);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });
    if (!resp.ok) return json({ error: `Claude API ${resp.status}: ${await resp.text()}` }, 502);

    const payload = await resp.json();
    const markdown = (payload.content ?? [])
      .filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();

    const { error: upErr } = await supabase.from('reference_cases')
      .update({ generated_markdown: markdown, status: 'generated' }).eq('id', id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ markdown });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 2: Deploy + set secrets (manual)**

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase secrets set ANTHROPIC_API_KEY=<your-claude-key>
npx supabase functions deploy generate-case --no-verify-jwt
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform.)
Expected: deploy prints the function URL `https://<ref>.supabase.co/functions/v1/generate-case`.

- [ ] **Step 3: Smoke-test with a seeded row (manual)**

Insert one row via the Table Editor (fill required fields), copy its `id`, then:
```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/generate-case" \
  -H "content-type: application/json" -d '{"id":"<row-id>"}'
```
Expected: JSON `{ "markdown": "# ..." }`; the row's `status` becomes `generated` and `generated_markdown` is populated.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/generate-case/index.ts
git commit -m "feat: generate-case Edge Function (Claude Sonnet 5)"
```

---

## Task 8: Front shell + Beyond Data theme

Static HTML shell with three sections (list/form/preview) toggled by a class, plus the theme CSS. No logic yet.

**Files:**
- Create: `src/index.html`
- Create: `src/styles.css`
- Create: `src/config.js`

- [ ] **Step 1: Write `config.js` (public values, no secrets)**

`src/config.js`:
```javascript
// Public config. The anon key is safe to expose (RLS-protected). No secrets here.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://<PROJECT_REF>.supabase.co',
  SUPABASE_ANON_KEY: '<ANON_KEY>',
  FUNCTION_URL: 'https://<PROJECT_REF>.supabase.co/functions/v1/generate-case',
  DB_SCHEMA: 'refcases',
};
```

- [ ] **Step 2: Write `styles.css` (Beyond Data theme)**

`src/styles.css`:
```css
:root {
  --bg: #ffffff; --surface: #f5f7fa; --navy: #0b1e3f; --text: #2b3440;
  --muted: #6b7683; --accent: #1d6fe0; --border: #e2e8f0; --radius: 8px;
  --shadow: 0 1px 3px rgba(11,30,63,.08), 0 4px 12px rgba(11,30,63,.05);
  --font: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); color: var(--text); background: var(--bg); }
header.appbar {
  background: var(--navy); color: #fff; padding: 16px 24px;
  display: flex; align-items: center; justify-content: space-between;
}
header.appbar h1 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: .3px; }
main { max-width: 900px; margin: 0 auto; padding: 24px; }
h2 { color: var(--navy); font-weight: 600; }
.view { display: none; }
.view.active { display: block; }
.card {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 16px; margin-bottom: 12px;
}
label { display: block; font-weight: 600; margin: 12px 0 4px; font-size: 14px; }
input, select, textarea {
  width: 100%; padding: 9px 11px; border: 1px solid var(--border);
  border-radius: var(--radius); font: inherit; color: var(--text); background: var(--bg);
}
textarea { min-height: 90px; resize: vertical; }
select[multiple] { min-height: 140px; }
.btn {
  border: none; border-radius: var(--radius); padding: 10px 16px; font-weight: 600;
  cursor: pointer; background: var(--accent); color: #fff; font-size: 14px;
}
.btn.secondary { background: var(--surface); color: var(--navy); border: 1px solid var(--border); }
.btn:disabled { opacity: .5; cursor: default; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row > * { flex: 1; min-width: 180px; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--surface); color: var(--muted); }
.badge.generated { background: #e6f0fd; color: var(--accent); }
.muted { color: var(--muted); font-size: 13px; }
.error { color: #b42318; font-size: 13px; margin: 6px 0; }
.checkgroup { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.checkgroup label { font-weight: 400; display: flex; align-items: center; gap: 6px; margin: 0; }
.checkgroup input { width: auto; }
.tech-cat { margin-top: 8px; }
.tech-cat > strong { color: var(--navy); font-size: 13px; }
#preview-content { background: var(--bg); }
#preview-content h1 { color: var(--navy); }
#preview-content h2 { color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 4px; }
```

- [ ] **Step 3: Write `index.html` (shell)**

`src/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agilos — Reference Cases</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="appbar">
    <h1>Agilos · Reference Cases</h1>
    <button id="nav-new" class="btn">+ New reference case</button>
  </header>
  <main>
    <!-- LIST -->
    <section id="view-list" class="view active">
      <h2>Reference cases</h2>
      <div id="list-container"><p class="muted">Loading…</p></div>
    </section>

    <!-- FORM -->
    <section id="view-form" class="view">
      <h2 id="form-title">New reference case</h2>
      <div id="form-errors"></div>
      <form id="case-form" class="card">
        <label>Consultant(s)</label>
        <select id="f-consultants" multiple required></select>

        <div class="row">
          <div>
            <label>Client name</label>
            <input id="f-client-name" type="text" />
          </div>
          <div>
            <label>Client sector</label>
            <select id="f-sector"></select>
          </div>
        </div>
        <label class="checkgroup"><input id="f-confidential" type="checkbox" /> Client is confidential (anonymise)</label>

        <div class="row">
          <div><label>Start month</label><input id="f-start" type="month" /></div>
          <div><label>End month</label><input id="f-end" type="month" /></div>
          <div><label class="checkgroup" style="margin-top:34px"><input id="f-ongoing" type="checkbox" /> Ongoing</label></div>
        </div>

        <label>Technologies</label>
        <div id="f-tech" class="checkgroup-container"></div>

        <div class="row">
          <div><label>Consultant role</label><input id="f-role" type="text" placeholder="e.g. Lead Qlik Developer" /></div>
          <div><label>Team size</label><input id="f-team" type="number" min="1" /></div>
        </div>

        <label>Business context / challenge</label>
        <textarea id="f-context"></textarea>
        <label>Solution delivered</label>
        <textarea id="f-solution"></textarea>
        <label>Results / value delivered</label>
        <textarea id="f-results"></textarea>
        <label>Client testimonial (optional)</label>
        <textarea id="f-testimonial"></textarea>

        <div class="row" style="margin-top:16px">
          <button type="submit" class="btn">Save</button>
          <button type="button" id="form-cancel" class="btn secondary">Cancel</button>
        </div>
      </form>
    </section>

    <!-- PREVIEW -->
    <section id="view-preview" class="view">
      <div class="row">
        <button id="pv-back" class="btn secondary">← Back</button>
        <button id="pv-generate" class="btn">Generate with AI</button>
        <button id="pv-pdf" class="btn secondary">Export PDF</button>
        <button id="pv-word" class="btn secondary">Export Word</button>
      </div>
      <div id="pv-status" class="muted"></div>
      <div id="preview-content" class="card"></div>
    </section>
  </main>

  <!-- Export libs (GitHub Pages has no strict CSP) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/index.umd.min.js"></script>
  <script src="config.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Manual verify**

Run: `npx serve src` (or `python -m http.server 8080 -d src`) and open the URL.
Expected: navy header "Agilos · Reference Cases", "Reference cases" list section shows "Loading…" (app.js not built yet → console may show errors; that is fine until Task 9). Layout uses the Inter font and theme colours.

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/styles.css src/config.js
git commit -m "feat: front shell + Beyond Data theme"
```

---

## Task 9: Supabase client + list view

**Files:**
- Create: `src/supabaseClient.mjs`
- Create: `src/app.js` (list rendering + navigation; extended in later tasks)

- [ ] **Step 1: Write `supabaseClient.mjs`**

`src/supabaseClient.mjs`:
```javascript
const { SUPABASE_URL, SUPABASE_ANON_KEY, DB_SCHEMA } = window.APP_CONFIG;
const REST = `${SUPABASE_URL}/rest/v1/reference_cases`;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Profile': DB_SCHEMA,
    'Accept-Profile': DB_SCHEMA,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function listCases() {
  const res = await fetch(`${REST}?select=*&order=updated_at.desc`, { headers: headers() });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function getCase(id) {
  const res = await fetch(`${REST}?id=eq.${id}&select=*`, { headers: headers() });
  if (!res.ok) throw new Error(`Get failed: ${res.status}`);
  return (await res.json())[0];
}

export async function insertCase(record) {
  const res = await fetch(REST, {
    method: 'POST', headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Insert failed: ${res.status} ${await res.text()}`);
  return (await res.json())[0];
}

export async function updateCase(id, record) {
  const res = await fetch(`${REST}?id=eq.${id}`, {
    method: 'PATCH', headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
  return (await res.json())[0];
}
```

- [ ] **Step 2: Write `app.js` (list + navigation)**

`src/app.js`:
```javascript
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
```

- [ ] **Step 3: Manual verify**

Ensure `config.js` has real `SUPABASE_URL`/`SUPABASE_ANON_KEY`. Insert a test row in the Table Editor. Serve (`npx serve src`) and reload.
Expected: the list shows a card for the row (client/consultants/duration/status badge). No console errors from `listCases`.

- [ ] **Step 4: Commit**

```bash
git add src/supabaseClient.mjs src/app.js
git commit -m "feat: Supabase REST client + list view"
```

---

## Task 10: Form view (create/edit)

Populates dropdowns from `reference-data.json`, reads/writes a record, validates before save.

**Files:**
- Modify: `src/app.js` (replace the `openForm` placeholder; add form helpers)

- [ ] **Step 1: Replace `openForm` and add form logic in `app.js`**

Add these imports at the top of `src/app.js`:
```javascript
import { validateCase } from './lib/format.mjs';
import { insertCase, updateCase } from './supabaseClient.mjs';
```

Replace `export function openForm() {}` with:
```javascript
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
```

- [ ] **Step 2: Manual verify — create**

Serve, click "+ New reference case". Expected: consultant list and sector dropdown populated from `reference-data.json`; technology checkboxes grouped by category. Submitting empty shows validation errors. Fill required fields → Save → row appears in Supabase and app switches to the (empty) preview.

- [ ] **Step 3: Manual verify — edit**

From the list, open a case; (edit wiring is added in Task 12's preview "Edit" button — for now verify create works). Expected: create round-trips to Supabase without console errors.

- [ ] **Step 4: Commit**

```bash
git add src/app.js
git commit -m "feat: reference case form (create/edit) with validation"
```

---

## Task 11: Markdown renderer (pure)

Renders the AI markdown to safe HTML for preview/export. Minimal parser (headings, paragraphs, bold, lists) — no external dep, escapes HTML.

**Files:**
- Create: `src/lib/markdown.mjs`
- Test: `src/lib/markdown.test.mjs`

- [ ] **Step 1: Write the failing test**

`src/lib/markdown.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml } from './markdown.mjs';

test('renders h1 and h2', () => {
  const html = mdToHtml('# Title\n## Section');
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<h2>Section<\/h2>/);
});

test('renders bold and paragraphs', () => {
  const html = mdToHtml('Hello **world**');
  assert.match(html, /<p>Hello <strong>world<\/strong><\/p>/);
});

test('renders bullet lists', () => {
  const html = mdToHtml('- a\n- b');
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
});

test('escapes raw HTML', () => {
  const html = mdToHtml('<script>alert(1)</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/markdown.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `markdown.mjs`**

`src/lib/markdown.mjs`:
```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/markdown.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.mjs src/lib/markdown.test.mjs
git commit -m "feat: minimal safe markdown->html renderer"
```

---

## Task 12: Preview, generate, and export

Wires the preview view: render markdown, call the Edge Function to generate, edit, and export to PDF/Word.

**Files:**
- Create: `src/export.mjs`
- Modify: `src/app.js` (replace `renderPreview` placeholder; add generate + export + edit wiring)

- [ ] **Step 1: Write `export.mjs`**

`src/export.mjs`:
```javascript
// Uses globals html2pdf (bundle) and docx (UMD) loaded in index.html.
export function exportPdf(containerEl, filename) {
  // eslint-disable-next-line no-undef
  html2pdf().set({
    margin: 12, filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(containerEl).save();
}

export function exportWord(markdown, filename) {
  // eslint-disable-next-line no-undef
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx;
  const NAVY = '0B1E3F', ACCENT = '1D6FE0';
  const children = [];
  for (const raw of String(markdown).replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.slice(3), color: ACCENT, bold: true })] }));
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line.slice(2), color: NAVY, bold: true })] }));
    } else if (line.startsWith('- ')) {
      children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else {
      const runs = line.split(/\*\*(.+?)\*\*/).map((part, i) =>
        new TextRun({ text: part, bold: i % 2 === 1 }));
      children.push(new Paragraph({ children: runs }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  });
}
```

- [ ] **Step 2: Wire preview/generate/export/edit in `app.js`**

Add imports at the top of `src/app.js`:
```javascript
import { mdToHtml } from './lib/markdown.mjs';
import { exportPdf, exportWord } from './export.mjs';
```

Replace `export function renderPreview() {}` with:
```javascript
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
```

Add an "Edit" button handler by inserting into the preview button row wiring (top-level in `app.js`):
```javascript
document.getElementById('pv-back').insertAdjacentHTML('afterend',
  '<button id="pv-edit" class="btn secondary">Edit fields</button>');
document.getElementById('pv-edit').addEventListener('click', () => openForm(window.__currentCase));
```

- [ ] **Step 3: Manual verify — full flow**

With Task 7's function deployed and `config.js` filled: create a case → preview → "Generate with AI".
Expected: status shows "Generating…", then the rendered reference case (Title + sections) appears; "Export PDF" and "Export Word" enable. PDF downloads a formatted A4; Word downloads a `.docx` with navy title and blue section headings. "Edit fields" reopens the form with values prefilled.

- [ ] **Step 4: Commit**

```bash
git add src/export.mjs src/app.js
git commit -m "feat: preview, AI generation, PDF/Word export, edit"
```

---

## Task 13: Deploy workflow + README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

- [ ] **Step 1: Write the deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: src
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write `README.md`**

`README.md`:
```markdown
# Agilos Reference Cases

Internal web app to document consultant reference cases and generate polished,
client-facing write-ups (English) with Claude, exportable to PDF and Word.

## Architecture
- **Front:** static HTML/CSS/ES modules in `src/`, deployed to GitHub Pages via Actions.
- **DB:** Supabase, schema `refcases`, table `reference_cases` (see `supabase/schema.sql`).
- **AI:** Supabase Edge Function `generate-case` calls Claude (`claude-sonnet-5`); the API key stays server-side.
- **Reference data:** `src/data/reference-data.json`, generated from `Competence martix.xlsx`.

## Setup
1. `npm install`
2. Create the DB: run `supabase/schema.sql` in the Supabase SQL editor; expose schema `refcases` (Settings → API).
3. Deploy the function:
   ```bash
   npx supabase login && npx supabase link --project-ref <REF>
   npx supabase secrets set ANTHROPIC_API_KEY=<key>
   npx supabase functions deploy generate-case --no-verify-jwt
   ```
4. Fill `src/config.js` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FUNCTION_URL`.
5. Regenerate reference data when the matrix changes: `npm run build:refdata`.

## Develop
- Run tests: `npm test`
- Serve locally: `npx serve src`

## Deploy
Push to `main`; the GitHub Pages workflow publishes `src/`.
In the repo: Settings → Pages → Source = GitHub Actions.

## Security
No secrets in the repo. The Claude key is a Supabase function secret; the Supabase
anon key in `config.js` is public by design and protected by RLS.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests across `src/lib/` and `supabase/functions/_shared/` pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "chore: GitHub Pages deploy workflow + README"
```

- [ ] **Step 5: Connect remote and push (manual, after repo exists)**

```bash
git remote add origin https://github.com/MGE-Agilos/ReferenceCases.git
git push -u origin main
```
Then in the repo: Settings → Pages → Source = **GitHub Actions**.
Expected: the Deploy workflow runs green; the app is live at the Pages URL.

---

## Notes for the implementer
- `config.js` and `supabase/schema.sql` contain placeholders (`<PROJECT_REF>`, `<ANON_KEY>`) that Maxime fills with real Supabase values — do not invent them.
- Tasks 6, 7, 9–13 have **manual** verification because they touch Supabase/browser/deploy; run them exactly as written and confirm the expected output before committing.
- Never commit `.env` or the Claude key. The `.gitignore` already covers `.env` and the xlsx.
```
