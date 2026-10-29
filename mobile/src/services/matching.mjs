export async function searchMatches({ apiUrl, token, description = '', image = '' }, request = fetch) {
  if (!description.trim() && !image) throw new Error('Enter a description or photo to search.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await request(`${apiUrl.replace(/\/+$/, '')}/ai/match`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ item_type: 'lost', description: description.trim(), image_base64: image || '' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Matching service unavailable. Try again later.');
    if (!Array.isArray(data.matches)) throw new Error('Invalid matching response. Please try again.');
    return data.matches.filter(item => ['active', 'pending'].includes(item.status));
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Matching timed out. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
