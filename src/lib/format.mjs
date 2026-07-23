const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function label(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function monthsBetween(startYm, endYm) {
  const [ys, ms] = startYm.split('-').map(Number);
  const [ye, me] = endYm.split('-').map(Number);
  return (ye - ys) * 12 + (me - ms) + 1; // inclusive
}

export function formatDuration(start, end, ongoing) {
  if (!start) return '';
  if (ongoing) return `${label(start)} – ongoing`;
  if (!end || end === start) {
    const n = end ? monthsBetween(start, end) : 1;
    return `${label(start)} (${n} month${n > 1 ? 's' : ''})`;
  }
  const n = monthsBetween(start, end);
  return `${label(start)} – ${label(end)} (${n} month${n > 1 ? 's' : ''})`;
}

export function validateCase(rec) {
  const errors = [];
  if (!rec.consultants || rec.consultants.length === 0) errors.push('At least one consultant is required');
  if (!rec.client_name || !rec.client_name.trim()) errors.push('Client name is required');
  if (!rec.client_sector) errors.push('Client sector is required');
  if (!rec.duration_start) errors.push('Start month is required');
  if (!rec.is_ongoing && !rec.duration_end) errors.push('End month is required (or mark as ongoing)');
  if (!rec.technologies || rec.technologies.length === 0) errors.push('At least one technology is required');
  if (!rec.context_challenge || !rec.context_challenge.trim()) errors.push('Business context/challenge is required');
  if (!rec.solution || !rec.solution.trim()) errors.push('Solution description is required');
  if (!rec.results || !rec.results.trim()) errors.push('Results/value delivered is required');
  return errors;
}
