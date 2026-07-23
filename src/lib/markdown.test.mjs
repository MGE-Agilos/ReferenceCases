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
