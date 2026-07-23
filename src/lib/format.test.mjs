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
