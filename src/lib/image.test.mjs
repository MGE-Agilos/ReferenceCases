import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageFile, extForType, publicUrl, MAX_IMAGE_BYTES } from './image.mjs';

test('validateImageFile accepts a normal PNG', () => {
  assert.equal(validateImageFile({ type: 'image/png', size: 1000 }), null);
});

test('validateImageFile rejects unsupported types', () => {
  assert.match(validateImageFile({ type: 'application/pdf', size: 1000 }), /Unsupported/);
});

test('validateImageFile rejects oversized files', () => {
  assert.match(validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }), /too large/);
});

test('extForType maps mime to extension', () => {
  assert.equal(extForType('image/jpeg'), 'jpg');
  assert.equal(extForType('image/webp'), 'webp');
  assert.equal(extForType('image/unknown'), 'png');
});

test('publicUrl builds the storage public path', () => {
  assert.equal(
    publicUrl('https://x.supabase.co', 'refcase-images', 'abc/1.png'),
    'https://x.supabase.co/storage/v1/object/public/refcase-images/abc/1.png',
  );
});
