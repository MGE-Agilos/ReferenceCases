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
    'Write a polished, client-facing reference case in English from the structured facts provided.',
    'Use a confident, factual, non-boastful tone. Do not invent facts, metrics, or client names not provided.',
    `Output GitHub-flavoured Markdown with exactly these sections as \`##\` headings, in order: ${SECTIONS.join(', ')}.`,
    'The Title section is a single \`#\` heading line (a short, compelling project title), not a \`##\` heading.',
    confidential
      ? 'The client is CONFIDENTIAL: never state the client name. Anonymise the client by referring to them using the sector, e.g. "a leading player in the Banking sector".'
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
