import { Router } from 'express';
import supabase from '../db.js';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [lostItems, foundItems, users, categories, matches, recentActivity] = await Promise.all([
      supabase.from('lost_items').select('*', { count: 'exact', head: true }),
      supabase.from('found_items').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('categories').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(10),
    ]);

    // Get status breakdowns — count potential_match and claimed as matched
    const [lostPending, lostActive, lostPotentialMatch, lostClaimed] = await Promise.all([
      supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'potential_match'),
      supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'claimed'),
    ]);

    const [foundActive, foundPotentialMatch, foundClaimed] = await Promise.all([
      supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'potential_match'),
      supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'claimed'),
    ]);

    // "Successfully Matched" = count only lost items that are matched (potential_match + claimed)
    // Each matched lost item corresponds to a found item — counting both would double-count
    const successfullyMatched = (lostPotentialMatch.count || 0) + (lostClaimed.count || 0);

    res.json({
      totalLostItems: lostItems.count || 0,
      totalFoundItems: foundItems.count || 0,
      totalUsers: users.count || 0,
      totalCategories: categories.count || 0,
      totalMatches: successfullyMatched,
      lostPending: lostPending.count || 0,
      lostActive: lostActive.count || 0,
      lostPotentialMatch: lostPotentialMatch.count || 0,
      lostClaimed: lostClaimed.count || 0,
      foundActive: foundActive.count || 0,
      foundPotentialMatch: foundPotentialMatch.count || 0,
      foundClaimed: foundClaimed.count || 0,
      recentActivity: recentActivity.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/recent-items
router.get('/recent-items', async (req, res) => {
  try {
    const [lostRecent, foundRecent] = await Promise.all([
      supabase.from('lost_items').select('*').order('date_reported', { ascending: false }).limit(5),
      supabase.from('found_items').select('*').order('date_found', { ascending: false }).limit(5),
    ]);

    res.json({
      recentLost: lostRecent.data || [],
      recentFound: foundRecent.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/location-heatmap — location stats for lost and found items
router.get('/location-heatmap', async (req, res) => {
  try {
    const [lostItems, foundItems] = await Promise.all([
      supabase.from('lost_items').select('location_lost'),
      supabase.from('found_items').select('location_found'),
    ]);

    // Count occurrences per location for lost items
    const lostLocations = {};
    (lostItems.data || []).forEach(item => {
      const loc = (item.location_lost || 'Unknown').trim();
      lostLocations[loc] = (lostLocations[loc] || 0) + 1;
    });

    // Count occurrences per location for found items
    const foundLocations = {};
    (foundItems.data || []).forEach(item => {
      const loc = (item.location_found || 'Unknown').trim();
      foundLocations[loc] = (foundLocations[loc] || 0) + 1;
    });

    // Convert to sorted arrays
    const lostArray = Object.entries(lostLocations)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    const foundArray = Object.entries(foundLocations)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ lost: lostArray, found: foundArray });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;