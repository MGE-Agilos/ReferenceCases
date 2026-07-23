// Column layout constants (0-indexed) matching Competence Matrix "Feuil1".
const CATEGORY_ROW = 0;
const TECH_ROW = 1;
const CONSULTANT_START_ROW = 7;
const NAME_COL = 1;
const FIRST_TECH_COL = 5;
// Categories that are not real technologies (kept out of the tech picker).
const NON_TECH_CATEGORIES = new Set([
  'Sector', 'Principles', 'Dutch', 'French', 'English', 'German', 'Others',
]);
// Extra sectors not present in the matrix, appended (deduped) to the sector list.
export const EXTRA_SECTORS = ['Association humanitaire'];

export function buildReferenceData(rows) {
  const categoryRow = rows[CATEGORY_ROW] || [];
  const techRow = rows[TECH_ROW] || [];

  // Forward-fill category labels across their column span.
  const colCategory = [];
  let current = '';
  for (let col = FIRST_TECH_COL; col < techRow.length; col++) {
    if (categoryRow[col]) current = String(categoryRow[col]).trim();
    colCategory[col] = current;
  }

  const technologies = {};
  const sectors = [];
  for (let col = FIRST_TECH_COL; col < techRow.length; col++) {
    const label = techRow[col];
    if (!label) continue;
    const category = colCategory[col];
    const name = String(label).trim();
    if (category === 'Sector') {
      sectors.push(name);
    } else if (!NON_TECH_CATEGORIES.has(category)) {
      (technologies[category] ||= []).push(name);
    }
  }

  const consultants = [];
  for (let r = CONSULTANT_START_ROW; r < rows.length; r++) {
    const raw = rows[r]?.[NAME_COL];
    if (!raw) continue;
    const name = String(raw).trim();
    if (!name || name.toUpperCase() === 'TOTAL') continue;
    consultants.push(name);
  }

  for (const s of EXTRA_SECTORS) if (!sectors.includes(s)) sectors.push(s);

  return { consultants, sectors, technologies };
}
