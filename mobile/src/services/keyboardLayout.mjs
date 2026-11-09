export function keyboardOverlap(top, height, keyboard, windowScreenOffset = 0) {
  if (!keyboard || !Number.isFinite(keyboard.screenY) || !(keyboard.height > 0) || !(height > 0)) return 0;
  return Math.max(0, Math.min(height, top + height + windowScreenOffset - keyboard.screenY));
}
export function focusedFieldScroll({ fieldTop, fieldHeight, viewportTop, viewportHeight, keyboardTop, offset, gap = 24 }) {
  const visibleBottom = Math.min(viewportTop + viewportHeight, keyboardTop ?? Infinity) - gap;
  const visibleTop = viewportTop + gap;
  const bottom = Math.min(fieldTop + fieldHeight, fieldTop + Math.max(0, visibleBottom - visibleTop));
  if (bottom > visibleBottom) return Math.max(0, offset + bottom - visibleBottom);
  if (fieldTop < visibleTop) return Math.max(0, offset + fieldTop - visibleTop);
  return null;
}
