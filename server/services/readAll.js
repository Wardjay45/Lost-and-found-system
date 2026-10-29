// Avoid silently forecasting from only the first Supabase result page.
export async function readAll(query) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Unable to load complete report history.');
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
