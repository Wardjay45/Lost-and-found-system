export const reportCollectionStatus = collection => {
  if (collection === 'potential') return 'potential_match';
  if (collection === 'claimed') return 'claimed';
  throw new Error('Unknown report collection.');
};

export async function loadReportCollection(collection, { lostItemsApi, foundItemsApi }) {
  const status = reportCollectionStatus(collection);
  const [lost, found] = await Promise.all([
    lostItemsApi.getAll({ status }), foundItemsApi.getAll({ status }),
  ]);
  if (!Array.isArray(lost) || !Array.isArray(found)) throw new Error('Unable to load complete item reports.');
  return [['lost', lost], ['found', found]].flatMap(([reportType, rows]) => rows
    .filter(item => item.status === status)
    .map(item => ({ ...item, reportType, collectionKey: reportType + ':' + item.id,
      reportDate: reportType === 'lost' ? item.date_reported : item.date_found,
      reportLocation: reportType === 'lost' ? item.location_lost : item.location_found,
      reportedBy: reportType === 'lost' ? item.reporter_name : item.finder_name,
    })))
    .sort((a, b) => {
      const stamp = row => Date.parse(collection === 'claimed' ? row.resolved_date || row.reportDate : row.reportDate) || 0;
      return stamp(b) - stamp(a) || a.collectionKey.localeCompare(b.collectionKey);
    });
}

export function filterReportCollection(reports, { reportType = 'all', search = '' } = {}) {
  const query = search.trim().toLowerCase();
  return reports.filter(item => (reportType === 'all' || item.reportType === reportType) && (!query ||
    [item.description, item.item_id, item.id, item.category_name, item.reportLocation, item.location_details, item.reportedBy]
      .some(value => String(value ?? '').toLowerCase().includes(query))));
}
