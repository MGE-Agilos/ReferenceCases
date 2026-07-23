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

test('extracts matrix sectors then appends extra sectors', () => {
  const data = buildReferenceData(makeRows());
  assert.deepEqual(data.sectors, ['Banking', 'Public', 'Non-profit / NGO']);
});

test('does not duplicate an extra sector already present in the matrix', () => {
  const rows = makeRows();
  rows[1][8] = 'Non-profit / NGO'; // matrix already lists it under Sector
  const data = buildReferenceData(rows);
  assert.equal(data.sectors.filter((s) => s === 'Non-profit / NGO').length, 1);
});
