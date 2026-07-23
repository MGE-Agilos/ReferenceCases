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
