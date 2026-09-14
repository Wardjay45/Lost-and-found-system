import { Router } from 'express';
import supabase from '../db.js';

const router = Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Category not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories
router.post('/', async (req, res) => {
  try {
    const { name, icon, color, description, keywords } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const { data, error } = await supabase
      .from('categories')
      .insert({ name, icon: icon || '📦', color: color || '#78716c', description: description || '', keywords: keywords || '' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, icon, color, description, keywords, auto_tagging } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;
    if (keywords !== undefined) updates.keywords = keywords;
    if (auto_tagging !== undefined) updates.auto_tagging = auto_tagging;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Category not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories (Bulk update for save all)
router.put('/', async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ error: 'categories array required' });

    const results = [];
    for (const cat of categories) {
      const { data, error } = await supabase
        .from('categories')
        .update({ auto_tagging: cat.auto_tagging, updated_at: new Date().toISOString() })
        .eq('id', cat.id)
        .select()
        .single();
      if (!error && data) results.push(data);
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;