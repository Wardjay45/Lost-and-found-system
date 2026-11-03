// Embedding calculations can overshoot cosine bounds by float32 rounding.
// Accept only that small tolerance; malformed and genuinely invalid scores fail.
export function normalizeMatchScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1 + 1e-5) return null;
  return Math.max(-1, Math.min(1, value));
}
