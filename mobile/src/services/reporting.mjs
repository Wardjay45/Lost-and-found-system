// Shared read path for the signed-in user's lost and found reports.
export async function loadUserReports(client, userId, { summary = false } = {}) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('A signed-in user is required to load reports.');
  }

  const lostFields = summary
    ? 'id, description, date_reported, location_lost, status'
    : '*';
  const foundFields = summary
    ? 'id, description, date_found, location_found, status'
    : '*';

  const [lostResult, foundResult] = await Promise.all([
    client.from('lost_items').select(lostFields).eq('reporter_id', userId),
    client.from('found_items').select(foundFields).eq('finder_id', userId),
  ]);

  if (lostResult.error) throw lostResult.error;
  if (foundResult.error) throw foundResult.error;

  return {
    lost: Array.isArray(lostResult.data) ? lostResult.data : [],
    found: Array.isArray(foundResult.data) ? foundResult.data : [],
  };
}
export function validateReportFields({ description, category, location, name, userId }) {
  const cleanDescription = (description || '').trim();
  const cleanCategory = (category || '').trim();
  const cleanLocation = (location || '').trim();
  const cleanName = (name || '').trim();

  if (userId === null || userId === undefined || userId === '' || !cleanName) {
    return { error: 'Please sign in again before submitting your report.' };
  }
  if (!cleanDescription || !cleanCategory || !cleanLocation) {
    return { error: 'Complete the description, category, and location.' };
  }
  return { error: null, cleanDescription, cleanCategory, cleanLocation, cleanName };
}

export function optionalLocationDetails(value) {
  const details = typeof value === 'string' ? value.trim() : '';
  return details ? { location_details: details } : {};
}

export async function loadReportLocations(client) {
  const { data, error } = await client.from('qr_locations')
    .select('id,name,is_active').eq('is_active', true).order('name');
  if (error || !Array.isArray(data)) throw new Error('Unable to load approved locations. Refresh to try again.');
  return data.filter(place => place.is_active === true && typeof place.name === 'string' && place.name.trim())
    .map(place => ({ ...place, name: place.name.trim() }));
}

export async function requireReportLocation(client, value) {
  const name = typeof value === 'string' ? value.trim() : '';
  const locations = await loadReportLocations(client);
  if (!locations.some(place => place.name === name)) {
    throw new Error('Select an active location added by the administrator. Refresh the locations and choose again.');
  }
  return name;
}
