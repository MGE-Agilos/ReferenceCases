// Pure helpers for image handling (unit-tested).

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Returns an error message string, or null when the file is acceptable.
export function validateImageFile({ type, size } = {}) {
  if (!ALLOWED_IMAGE_TYPES.includes(type)) return 'Unsupported file type (use PNG, JPG or WebP)';
  if (typeof size === 'number' && size > MAX_IMAGE_BYTES) return 'Image too large (max 5 MB)';
  return null;
}

export function extForType(type) {
  return EXT_BY_TYPE[type] || 'png';
}

// Build the public URL for a stored object.
export function publicUrl(supabaseUrl, bucket, path) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
