import { Router } from 'express';
import supabase from '../db.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { configuredCategoryStorage } from '../services/categoryStorage.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const categoryId = value => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(400, 'Choose a valid category.');
  return Number(value);
};

function categoryFields(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Enter valid category details.');
  const fields = {};
  const limits = { name: 100, icon: 100, color: 7, description: 2000, keywords: 2000 };
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string' || body[key].trim().length > limit) fail(400, `Enter a valid category ${key}.`);
    fields[key] = body[key].trim();
  }
  if ((creating || fields.name !== undefined) && !fields.name) fail(400, 'Category name is required.');
  if (fields.color !== undefined && !/^#[\da-f]{6}$/i.test(fields.color)) fail(400, 'Choose a valid category color.');
  if (body.auto_tagging !== undefined) {
    if (typeof body.auto_tagging !== 'boolean') fail(400, 'Category active status must be true or false.');
    fields.auto_tagging = body.auto_tagging;
  }
  if (!creating && !Object.keys(fields).length) fail(400, 'Enter a category change to save.');
  return creating ? { icon: '📦', color: '#78716c', description: '', keywords: '', ...fields } : fields;
}

export function createCategoriesRouter({ client = supabase, storage = configuredCategoryStorage, jwtSecret = () => process.env.JWT_SECRET } = {}) {
  const router = Router();
  const access = createProductionAccess(client, { jwtSecret });
  // Enforce authorization in development too. Only verified admin mutations use
  // server storage; the read client continues to use the anonymous key.
  router.use((req, res, next) => req.method === 'GET' ? next() : access(req, res, next));
  const handle = operation => async (req, res) => {
    try { await operation(req, res); }
    catch (error) {
      let status = error.status || 503;
      let message = error.status ? error.message : req.method === 'GET'
        ? 'Unable to load categories. Please try again.'
        : 'Unable to save category changes. Please try again.';
      if (error.code === '23503') {
        status = 409;
        message = 'This category is used by existing reports and cannot be deleted. Turn off its active status to stop using it for new reports.';
      } else if (error.code === '23505') {
        status = 409; message = 'A category with those details already exists.';
      }
      res.status(status).json({ error: message });
    }
  };
  const getCategory = async (db, id) => {
    const { data, error } = await db.from('categories').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) fail(404, 'Category not found.');
    return data;
  };

  router.get('/', handle(async (_req, res) => {
    const { data, error } = await client.from('categories').select('*').order('id');
    if (error) throw error;
    res.json(data || []);
  }));
  router.get('/:id', handle(async (req, res) => {
    res.json(await getCategory(client, categoryId(req.params.id)));
  }));
  router.post('/', handle(async (req, res) => {
    const fields = categoryFields(req.body, true);
    const { data, error } = await storage().from('categories').insert(fields).select().single();
    if (error) throw error;
    if (!data) fail(503, 'The category was not created. Please try again.');
    res.status(201).json(data);
  }));
  router.put('/:id', handle(async (req, res) => {
    const id = categoryId(req.params.id);
    const fields = categoryFields(req.body);
    const db = storage();
    const existing = await getCategory(db, id);
    const { data, error } = await db.from('categories')
      .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (!data) fail(404, 'Category not found.');

    // Synchronize existing icon snapshots on retry too, even if the category
    // itself already has the requested icon.
    if (fields.icon !== undefined) {
      const results = await Promise.all([
        db.from('lost_items').update({ category_icon: fields.icon }).eq('category_id', id),
        db.from('found_items').update({ category_icon: fields.icon }).eq('category_id', id),
        db.from('lost_items').update({ category_icon: fields.icon }).is('category_id', null).eq('category_name', existing.name),
        db.from('found_items').update({ category_icon: fields.icon }).is('category_id', null).eq('category_name', existing.name),
      ]);
      if (results.some(result => result.error)) fail(503, 'Category saved, but report icons could not be updated. Please retry saving the category.');
    }
    res.json(data);
  }));
  router.put('/', handle(async (req, res) => {
    const categories = req.body?.categories;
    if (!Array.isArray(categories) || !categories.length || categories.length > 1000) fail(400, 'Choose categories to update.');
    const ids = categories.map(cat => categoryId(cat?.id));
    if (new Set(ids).size !== ids.length || categories.some(cat => typeof cat.auto_tagging !== 'boolean')) fail(400, 'Enter valid category active settings.');
    const db = storage();
    // Reject missing categories before saving any submitted settings.
    const { data: existing, error: readError } = await db.from('categories').select('id').in('id', ids);
    if (readError) throw readError;
    if (!existing || existing.length !== ids.length) fail(404, 'A category no longer exists. Reopen Categories before saving.');
    const results = [];
    for (const [index, cat] of categories.entries()) {
      const { data, error } = await db.from('categories')
        .update({ auto_tagging: cat.auto_tagging, updated_at: new Date().toISOString() })
        .eq('id', ids[index]).select().maybeSingle();
      if (error || !data) fail(503, 'Unable to save all category settings. Some settings may already be saved; please retry Save All Changes.');
      results.push(data);
    }
    res.json(results);
  }));
  router.delete('/:id', handle(async (req, res) => {
    const id = categoryId(req.params.id);
    const { data, error } = await storage().from('categories').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) fail(404, 'Category not found or already deleted.');
    res.json({ message: 'Category deleted successfully' });
  }));
  return router;
}

export default createCategoriesRouter();
