export const THEME_POSITION_KEY = 'mobile-theme-button-position';
export const DRAG_THRESHOLD = 6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function buttonBounds(width, height, size, insets = {}) {
  const minX = Math.max(0, insets.left || 0) + 12;
  const minY = Math.max(0, insets.top || 0) + 12;
  return {
    minX, minY,
    maxX: Math.max(minX, width - Math.max(0, insets.right || 0) - size - 12),
    maxY: Math.max(minY, height - Math.max(0, insets.bottom || 0) - size - 12),
  };
}
export function clampButtonPosition(position, bounds) {
  return { x: clamp(position.x, bounds.minX, bounds.maxX), y: clamp(position.y, bounds.minY, bounds.maxY) };
}
export function normalizeButtonPosition(position, bounds) {
  const point = clampButtonPosition(position, bounds);
  return {
    x: (point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1),
    y: (point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1),
  };
}
export function restoreButtonPosition(position, bounds) {
  return clampButtonPosition({
    x: bounds.minX + position.x * (bounds.maxX - bounds.minX),
    y: bounds.minY + position.y * (bounds.maxY - bounds.minY),
  }, bounds);
}
export function parseButtonPosition(saved) {
  try {
    const position = JSON.parse(saved);
    return position && Number.isFinite(position.x) && Number.isFinite(position.y)
      && position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1
      ? { x: position.x, y: position.y } : null;
  } catch { return null; }
}
export function isButtonDrag({ dx, dy }) {
  return Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
}
