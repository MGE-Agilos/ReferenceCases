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
