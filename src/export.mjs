// Uses globals html2pdf (bundle) and docx (UMD) loaded in index.html.
export function exportPdf(containerEl, filename) {
  // eslint-disable-next-line no-undef
  html2pdf().set({
    margin: 12, filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(containerEl).save();
}

export function exportWord(markdown, filename) {
  // eslint-disable-next-line no-undef
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx;
  const NAVY = '0B1E3F', ACCENT = '1D6FE0';
  const children = [];
  for (const raw of String(markdown).replace(/\r\n/g, '\n').split('\n')) {
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
  const doc = new Document({ sections: [{ children }] });
  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  });
}
