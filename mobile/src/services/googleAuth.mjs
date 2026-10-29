export async function requestGoogleAuth(apiUrl, endpoint, body, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetcher(`${apiUrl.replace(/\/+$/, '')}/auth/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) return { error: result.error || 'Google sign-in failed. Please try again.' };
    if (result.registrationRequired && result.email) return result;
    if (!result.token || !result.user?.id) return { error: 'Invalid sign-in response. Please try again.' };
    return result;
  } catch {
    return { error: 'Unable to reach the school server. Check your connection and server address, then try again.' };
  } finally {
    clearTimeout(timeout);
  }
}
