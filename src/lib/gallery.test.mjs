import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galleryHtml, GALLERY_TITLE } from './gallery.mjs';

test('returns empty string when no images', () => {
  assert.equal(galleryHtml([]), '');
  assert.equal(galleryHtml(undefined), '');
});

test('renders a title and one figure per image', () => {
  const html = galleryHtml([{ url: 'a.png', caption: 'Dashboard' }, { url: 'b.png', caption: '' }]);
  assert.match(html, new RegExp(GALLERY_TITLE));
  assert.equal((html.match(/<figure/g) || []).length, 2);
  assert.match(html, /src="a\.png"/);
  assert.match(html, /<figcaption>Dashboard<\/figcaption>/);
});

test('omits figcaption when caption is empty', () => {
  const html = galleryHtml([{ url: 'b.png', caption: '' }]);
  assert.doesNotMatch(html, /figcaption/);
});

test('escapes captions and urls', () => {
  const html = galleryHtml([{ url: 'x.png"><script>', caption: '<b>hi</b>' }]);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>hi<\/b>/);
});
