import { useState, useEffect, useMemo } from 'react';
import { foundItemsApi } from '../services/api';
import { useAppSettings } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';

export default function UnclaimedItems() {
  const { settings } = useAppSettings();
  const unclaimedDays = settings.unclaimedDays || 60;

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    foundItemsApi
      .getAll()
      .then((data) => {
        const now = new Date();
        const threshold = new Date(now.getTime() - unclaimedDays * 24 * 60 * 60 * 1000);

        const unclaimed = (Array.isArray(data) ? data : [])
          .filter((item) => {
            const itemDate = new Date(item.date_found || item.created_at);
            return itemDate < threshold;
          })
          .sort((a, b) => new Date(b.date_found || b.created_at) - new Date(a.date_found || a.created_at));

        setItems(unclaimed);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unclaimedDays]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        (item.description || '').toLowerCase().includes(q) ||
        (item.category_name || item.category || '').toLowerCase().includes(q) ||
        (item.location_found || '').toLowerCase().includes(q) ||
        (item.item_id || '').toLowerCase().includes(q) ||
        (item.finder_name || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const daysAgo = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    return `${diff}d ago`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unclaimed Items</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Found items that have been unclaimed for over {unclaimedDays} days
          </p>
        </div>
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-4 py-2 rounded-lg text-sm font-medium">
          {items.length} unclaimed item{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by description, category, location, ID, or finder..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading unclaimed items...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm font-medium">
              {search.trim() ? 'No items match your search' : 'No unclaimed items'}
            </p>
            <p className="text-xs mt-1">
              {search.trim()
                ? 'Try a different search term'
                : `All found items have been claimed or are within ${unclaimedDays} days`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Finder</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Found</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((item, idx) => {
                  const dateStr = item.date_found || item.created_at;
                  return (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[250px]">
                          {item.description || 'No description'}
                        </p>
                        {item.item_id && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">ID: {item.item_id}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {item.category_name || item.category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 max-w-[180px] truncate">
                        {item.location_found || 'Unknown'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">
                        {item.finder_name || 'Anonymous'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(dateStr)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                          {daysAgo(dateStr)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={item.status || 'pending'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}