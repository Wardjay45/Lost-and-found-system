// PostgreSQL TIMESTAMP columns in this project store UTC without an offset.
// Parse those values explicitly so the browser's timezone cannot shift events.
export function parseStoredTimestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value) : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  let normalized = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T/.test(normalized)) {
    if (/[+-]\d{2}$/.test(normalized)) normalized += ':00';
    else if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) normalized += 'Z';
  }
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

const campusTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

export function formatCampusDateTime(value) {
  const date = parseStoredTimestamp(value);
  return date ? campusTime.format(date) : 'Time not recorded';
}
