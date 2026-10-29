function reportError(message, status) {
  return Object.assign(new Error(message), { status });
}

export function parseLocationDetails(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw reportError('Additional Info must be text of at most 500 characters.', 400);
  }
  const details = value.replace(/\r\n?/g, '\n');
  if (details.length > 500) throw reportError('Additional Info must be text of at most 500 characters.', 400);
  return details.trim() || null;
}

export async function requireReportLocation(client, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw reportError('Select an active location added by the administrator.', 400);
  }
  const { data, error } = await client.from('qr_locations').select('name,is_active').eq('is_active', true);
  if (error || !Array.isArray(data)) {
    throw reportError('Unable to load approved locations. Refresh and try again.', 503);
  }
  const location = data.find(place => place.is_active === true && place.name?.trim() === value.trim());
  if (!location) {
    throw reportError('Select an active location added by the administrator. Refresh the locations and choose again.', 400);
  }
  return location.name.trim();
}
