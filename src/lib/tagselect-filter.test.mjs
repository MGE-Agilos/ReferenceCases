import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, flattenOptions, filterOptions } from './tagselect-filter.mjs';

test('normalize strips accents and lowercases', () => {
  assert.equal(normalize('André Pato'), 'andre pato');
  assert.equal(normalize('  Jérôme  '), 'jerome');
});

test('flattenOptions handles a flat list', () => {
  assert.deepEqual(flattenOptions(['a', 'b']), [
    { value: 'a', group: '' }, { value: 'b', group: '' },
  ]);
});

test('flattenOptions handles grouped options', () => {
  const grouped = [{ group: 'Qlik', items: ['Qlik Sense'] }, { group: 'Talend', items: ['Talend Studio'] }];
  assert.deepEqual(flattenOptions(grouped), [
    { value: 'Qlik Sense', group: 'Qlik' }, { value: 'Talend Studio', group: 'Talend' },
  ]);
});

test('filterOptions excludes already-selected values', () => {
  const flat = flattenOptions(['Alice', 'Bob']);
  assert.deepEqual(filterOptions(flat, '', ['Alice']), [{ value: 'Bob', group: '' }]);
});

test('filterOptions matches case- and accent-insensitively', () => {
  const flat = flattenOptions(['André Pato', 'Bob']);
  assert.deepEqual(filterOptions(flat, 'andre', []), [{ value: 'André Pato', group: '' }]);
});

test('filterOptions returns all unselected when query empty', () => {
  const flat = flattenOptions(['Alice', 'Bob']);
  assert.equal(filterOptions(flat, '', []).length, 2);
});
