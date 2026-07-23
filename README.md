# Agilos Reference Cases

Internal web app to document consultant reference cases and generate polished,
client-facing write-ups (English) with Claude, exportable to PDF and Word.

## Architecture
- **Front:** static HTML/CSS/ES modules in `src/`, deployed to GitHub Pages via Actions.
- **DB:** Supabase, schema `refcases`, table `reference_cases` (see `supabase/schema.sql`).
- **AI:** Supabase Edge Function `generate-case` calls Claude (`claude-haiku-4-5-20251001`); the API key stays server-side.
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
