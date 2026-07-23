import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import { buildReferenceData } from '../src/lib/reference-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = resolve(__dirname, '../Competence martix.xlsx');
const OUT_PATH = resolve(__dirname, '../src/data/reference-data.json');

const wb = xlsx.read(readFileSync(XLSX_PATH), { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
// header:1 => array-of-arrays, defval:null keeps column alignment.
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

const data = buildReferenceData(rows);
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
console.log(
  `Wrote ${OUT_PATH}: ${data.consultants.length} consultants, ` +
  `${data.sectors.length} sectors, ${Object.keys(data.technologies).length} tech categories.`
);
