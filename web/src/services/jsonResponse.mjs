export async function readJsonResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const message = typeof data?.error === 'string' ? data.error
      : response.status === 413 ? 'This request contains too much photo data. Please use a smaller photo.'
        : !response.ok ? `Request failed (HTTP ${response.status}). Please try again.`
          : 'The server returned an invalid response. Please try again.';
    const error = new Error(message);
    error.code = data?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}
