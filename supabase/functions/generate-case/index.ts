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
