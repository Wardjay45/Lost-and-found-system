import { requireReportLocation, parseLocationDetails } from './reportLocations.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, label, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${max} characters.`);
  return value.trim();
};

export function createEditReportHandler({ client, kind, uploadImage = async value => value }) {
  const table = kind + '_items', location = kind === 'lost' ? 'location_lost' : 'location_found';
  const person = kind === 'lost' ? 'reporter_name' : 'finder_name';
  const allowed = new Set(['description', 'category_id', location, 'location_details', person, 'image', 'expected_last_updated', ...(kind === 'found' ? ['condition', 'current_location'] : [])]);
  return async (req, res) => {
    try {
      if (!['admin', 'superadmin'].includes(req.actor?.role)) return res.status(403).json({ error: 'Administrator access is required.' });
      const body = req.body;
      if (!body || Array.isArray(body) || Object.keys(body).some(key => !allowed.has(key))) fail('Only report details can be edited here. Use the dedicated actions for status changes.');
      const { data: current, error: readError } = await client.from(table).select('*').eq('id', req.params.id).maybeSingle();
      if (readError) throw readError;
      if (!current) return res.status(404).json({ error: 'Report not found.' });
      if (body.expected_last_updated !== undefined && body.expected_last_updated !== current.last_updated) return res.status(409).json({ error: 'This report changed. Reopen it before editing again.' });
      const updates = { last_updated: new Date().toISOString() };
      if (body.description !== undefined) {
        updates.description = text(body.description, 'Description', 10000, true);
        if (updates.description !== current.description) updates.text_embedding = null;
      }
      if (body[person] !== undefined) updates[person] = text(body[person], 'Reporter name', 200);
      if (body[location] !== undefined && body[location] !== current[location]) updates[location] = await requireReportLocation(client, body[location]);
      if (body.location_details !== undefined) updates.location_details = parseLocationDetails(body.location_details);
      if (body.category_id !== undefined && String(body.category_id) !== String(current.category_id)) {
        const id = Number(body.category_id);
        if (!Number.isSafeInteger(id) || id <= 0) fail('Select a valid category.');
        const { data: category, error } = await client.from('categories').select('id,name,icon,auto_tagging').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!category || category.auto_tagging === false) fail('Select an active category.');
        Object.assign(updates, { category_id: category.id, category_name: category.name, category_icon: category.icon });
      }
      if (body.image !== undefined && body.image !== current.image) {
        if (body.image !== null && (typeof body.image !== 'string' || body.image.length > 14000000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(body.image))) fail('Upload a JPEG, PNG or WebP image.');
        updates.image = body.image === null ? null : await uploadImage(body.image);
        updates.image_embedding = null;
      }
      if (kind === 'found') {
        if (body.condition !== undefined) updates.condition = text(body.condition, 'Condition', 100);
        if (body.current_location !== undefined) updates.current_location = text(body.current_location, 'Current storage location', 500);
      }
      let query = client.from(table).update(updates).eq('id', current.id);
      query = current.last_updated === null ? query.is('last_updated', null) : query.eq('last_updated', current.last_updated);
      const { data, error } = await query.select().maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ error: 'This report changed while saving. Reopen it and try again.' });
      res.json(data);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to update this report. Please try again.' });
    }
  };
}
