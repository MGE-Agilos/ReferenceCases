// Uses globals html2pdf (bundle) and docx (UMD) loaded in index.html.
import { GALLERY_TITLE } from './lib/gallery.mjs';

export function exportPdf(containerEl, filename) {
  // eslint-disable-next-line no-undef
  html2pdf().set({
    margin: 12, filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(containerEl).save();
}

// Fetch an image and compute display dimensions (max width in px, aspect preserved).
async function fetchImage(url, maxW = 480) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dims = await new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth || maxW, h: im.naturalHeight || maxW });
    im.onerror = () => resolve({ w: maxW, h: Math.round(maxW * 0.6) });
    im.src = url;
  });
  const scale = Math.min(1, maxW / dims.w);
  return { buf, width: Math.round(dims.w * scale), height: Math.round(dims.h * scale) };
}

export async function exportWord(markdown, images, filename) {
  // eslint-disable-next-line no-undef
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun } = docx;
  const NAVY = '0B1E3F', ACCENT = '1D6FE0';
  const children = [];
  for (const raw of String(markdown || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.slice(3), color: ACCENT, bold: true })] }));
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line.slice(2), color: NAVY, bold: true })] }));
    } else if (line.startsWith('- ')) {
      children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else {
      const runs = line.split(/\*\*(.+?)\*\*/).map((part, i) =>
        new TextRun({ text: part, bold: i % 2 === 1 }));
      children.push(new Paragraph({ children: runs }));
    }
  }

  const imgs = Array.isArray(images) ? images : [];
  if (imgs.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: GALLERY_TITLE, color: ACCENT, bold: true })] }));
    for (const img of imgs) {
      try {
        const { buf, width, height } = await fetchImage(img.url);
        children.push(new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width, height } })] }));
        if (img.caption) {
          children.push(new Paragraph({ children: [new TextRun({ text: img.caption, italics: true, color: '6B7683' })] }));
        }
      } catch { /* skip an image that fails to load */ }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
