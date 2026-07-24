// Pure helper: build the image-gallery HTML appended to a reference case.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const GALLERY_TITLE = 'Screenshots / Illustrations';

// images: [{ url, caption }]. Returns '' when there are none.
export function galleryHtml(images) {
  if (!Array.isArray(images) || images.length === 0) return '';
  const figures = images.map((img) => {
    const cap = img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : '';
    return `<figure class="rc-figure"><img src="${esc(img.url)}" alt="${esc(img.caption || '')}" />${cap}</figure>`;
  }).join('');
  return `<h2>${GALLERY_TITLE}</h2><div class="rc-gallery">${figures}</div>`;
}
