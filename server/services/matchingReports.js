const COMMON_COLUMNS = 'id,item_id,description,category_name,location_details,last_updated,status';
const PAGE_SIZE = 25;
const MAX_REPORTS = 500;
const photoCaches = new WeakMap();

function queryFailure(error, table) {
  const timeout = error.code === '57014' || /statement timeout/i.test(error.message || '');
  return Object.assign(new Error(timeout
    ? `The database took too long to load ${table === 'lost_items' ? 'lost' : 'found'} reports. Please try again.`
    : 'Unable to load matching reports. Please try again.', { cause: error }), { status: 503, code: error.code });
}

async function activeReports(client, table, model) {
  const fields = COMMON_COLUMNS + (table === 'lost_items'
    ? ',location_lost,reporter_name,reporter_id,date_reported'
    : ',location_found,finder_name,date_found,condition')
    + (model === 'e5' ? ',text_embedding' : '')
    + (['clip', 'resnet50', 'efficientnet-b0'].includes(model) ? ',image_embedding' : '');
  const rows = [];
  const selectedFields = fields.split(',');
  for (let offset = 0; offset < MAX_REPORTS; offset += PAGE_SIZE) {
    // Never aggregate the large inline photo column into a report-list query.
    const { data, error } = await client.from(table).select(fields).eq('status', 'active')
      .order('id').range(offset, Math.min(offset + PAGE_SIZE - 1, MAX_REPORTS - 1));
    if (error) throw queryFailure(error, table);
    if (!Array.isArray(data)) throw new Error('The database returned invalid matching reports.');
    rows.push(...data.map(row => Object.fromEntries(selectedFields
      .filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]))));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function readMatchingReports(client, model, { refresh = false } = {}) {
  const [lostItems, foundItems] = await Promise.all([
    activeReports(client, 'lost_items', model), activeReports(client, 'found_items', model),
  ]);
  if (!['clip', 'resnet50', 'efficientnet-b0'].includes(model) || !lostItems.length || !foundItems.length) return { lostItems, foundItems };

  let cache = photoCaches.get(client);
  if (!cache) { cache = new Map(); photoCaches.set(client, cache); }
  const rows = [...lostItems.map(item => ({ table: 'lost_items', item })), ...foundItems.map(item => ({ table: 'found_items', item }))];
  let next = 0, failure;
  // One photo per database response, with at most two reads in flight. Photos
  // are shared across models by report revision; current statuses are read anew.
  await Promise.all(Array.from({ length: 2 }, async () => {
    try {
      while (!failure && next < rows.length) {
        const { table, item } = rows[next++];
        const key = `${table}:${item.id}:${item.last_updated || ''}`;
        let entry = refresh ? null : cache.get(key);
        if (!entry || entry.expires <= Date.now()) {
          entry = { expires: Date.now() + 5 * 60 * 1000 };
          entry.promise = (async () => {
            const { data, error } = await client.from(table).select('image').eq('id', item.id).maybeSingle();
            if (error) throw queryFailure(error, table);
            return data?.image || null;
          })().catch(error => {
            if (cache.get(key) === entry) cache.delete(key);
            throw error;
          });
          cache.set(key, entry);
          while (cache.size > 64) cache.delete(cache.keys().next().value);
        }
        item.image = await entry.promise;
      }
      } catch (error) { failure ||= error; }
  }));
  if (failure) throw failure;
  return { lostItems, foundItems };
}
