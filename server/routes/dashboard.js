import { Router } from 'express';
import supabase from '../db.js';

export function createDashboardRouter({ client = supabase } = {}) {
const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [lostItems, foundItems, users, categories, matches, recentActivity, recoveries] = await Promise.all([
      client.from('lost_items').select('*', { count: 'exact', head: true }),
      client.from('found_items').select('*', { count: 'exact', head: true }),
      client.from('users').select('*', { count: 'exact', head: true }),
      client.from('categories').select('*', { count: 'exact', head: true }),
      client.from('matches').select('*', { count: 'exact', head: true }),
      client.from('activity_logs').select('*').order('timestamp', { ascending: false }).order('id', { ascending: false }).limit(10),
      client.from('item_recoveries').select('id', { count: 'exact', head: true }),
    ]);

    for (const result of [lostItems, foundItems, users, categories, matches, recentActivity, recoveries]) if (result.error) throw result.error;

    // Keep matching workload separate from verified recovery events.
    const [lostPending, lostActive, lostPotentialMatch, lostClaimed] = await Promise.all([
      client.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      client.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'potential_match'),
      client.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'claimed'),
    ]);

    const [foundPending, foundActive, foundPotentialMatch, foundClaimed] = await Promise.all([
      client.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      client.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'potential_match'),
      client.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'claimed'),
    ]);

    for (const result of [lostPending, lostActive, lostPotentialMatch, lostClaimed, foundPending, foundActive, foundPotentialMatch, foundClaimed]) if (result.error) throw result.error;

    // Legacy matching workload count, kept for existing analytics consumers.
    const successfullyMatched = (lostPotentialMatch.count || 0) + (lostClaimed.count || 0);

    res.json({
      totalLostItems: lostItems.count || 0,
      totalFoundItems: foundItems.count || 0,
      totalUsers: users.count || 0,
      totalCategories: categories.count || 0,
      totalMatches: successfullyMatched,
      totalPotentialMatches: lostPotentialMatch.count || 0,
      totalVerifiedRecoveries: recoveries.count || 0,
      lostPending: lostPending.count || 0,
      lostActive: lostActive.count || 0,
      lostPotentialMatch: lostPotentialMatch.count || 0,
      lostClaimed: lostClaimed.count || 0,
      foundPending: foundPending.count || 0,
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
      client.from('lost_items').select('*').order('date_reported', { ascending: false }).limit(5),
      client.from('found_items').select('*').order('date_found', { ascending: false }).limit(5),
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
      client.from('lost_items').select('location_lost'),
      client.from('found_items').select('location_found'),
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

return router;
}
export default createDashboardRouter();