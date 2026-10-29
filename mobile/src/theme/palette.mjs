export const palettes = {
  dark: {
    background: '#0b1424',
    surface: '#17263c',
    input: '#111f33',
    text: '#f6f8fc',
    muted: '#b0bfd1',
    accent: '#a5b4fc',
    border: '#364a63',
    tab: '#101d31',
    success: '#047857',
    warning: '#fbbf24',
    danger: '#b91c1c',
  },
  light: {
    background: '#f5f7fb',
    surface: '#ffffff',
    input: '#eef2f8',
    text: '#172033',
    muted: '#526278',
    accent: '#4338ca',
    border: '#d9e1ec',
    tab: '#ffffff',
    success: '#047857',
    warning: '#92400e',
    danger: '#b91c1c',
  },
  contrast: {
    background: '#000000',
    surface: '#111111',
    input: '#000000',
    text: '#ffffff',
    muted: '#e5e5e5',
    accent: '#ffcc00',
    border: '#ffffff',
    tab: '#000000',
    success: '#00e6a8',
    warning: '#ffcc00',
    danger: '#ff8080',
  },
};

const lightText = {
  '#f1f5f9': '#172033',
  '#f8fafc': '#172033',
  '#e2e8f0': '#25334a',
  '#cbd5e1': '#334155',
  '#94a3b8': '#526278',
  '#64748b': '#5b6b82',
  '#475569': '#5b6b82',
  '#818cf8': '#4338ca',
  '#a5b4fc': '#4338ca',
  '#f59e0b': '#92400e',
  '#fbbf24': '#92400e',
  '#34d399': '#047857',
  '#10b981': '#047857',
  '#ef4444': '#b91c1c',
  '#f87171': '#b91c1c',
  '#fecaca': '#b91c1c',
  '#8b5cf6': '#6d28d9',
  '#c4b5fd': '#4338ca',
  '#06b6d4': '#0e7490',
  '#3b82f6': '#1d4ed8',
  '#6366f1': '#4338ca',
};
const darkText = {
  '#f1f5f9': '#f6f8fc',
  '#f8fafc': '#f6f8fc',
  '#e2e8f0': '#e5edf7',
  '#cbd5e1': '#d1ddec',
  '#94a3b8': '#b0bfd1',
  '#64748b': '#a3b4c9',
  '#475569': '#93a5bc',
  '#818cf8': '#a5b4fc',
  '#a5b4fc': '#a5b4fc',
  '#f59e0b': '#fbbf24',
  '#fbbf24': '#fbbf24',
  '#34d399': '#34d399',
  '#10b981': '#34d399',
  '#ef4444': '#f87171',
  '#f87171': '#f87171',
  '#fecaca': '#fecaca',
  '#8b5cf6': '#c4b5fd',
  '#c4b5fd': '#c4b5fd',
  '#06b6d4': '#67e8f9',
  '#3b82f6': '#93c5fd',
  '#6366f1': '#a5b4fc',
};
const contrastText = Object.fromEntries(
  Object.keys(lightText).map(key => [key, key === '#818cf8' || key === '#a5b4fc' ? '#ffcc00' : '#ffffff'])
);

export function themeStyleColor(property, value, scheme) {
  if (typeof value !== 'string') return value;
  const color = value.toLowerCase().replace(/\s+/g, '');
  const palette = palettes[scheme];
  const isText = property === 'color';
  const isBorder = property.toLowerCase().includes('border') && property.toLowerCase().includes('color');
  const isBackground = property === 'backgroundColor';

  if (isText) return (scheme === 'light' ? lightText : scheme === 'contrast' ? contrastText : darkText)[color] || value;
  if (isBorder) {
    if (color.startsWith('rgba(148,163,184,') || color.startsWith('rgba(129,140,248,') ||
        ['#334155', '#475569'].includes(color)) return palette.border;
    return value;
  }
  if (!isBackground) return value;

  if (color === '#0f172a') return palette.background;
  if (color === '#1e293b' || color.startsWith('rgba(30,41,59,')) return palette.surface;
  if (color === '#334155' || color.startsWith('rgba(15,23,42,')) return palette.input;
  if (color === '#10b981') return '#047857';
  if (color === '#ef4444') return '#b91c1c';
  if (color.startsWith('rgba(148,163,184,')) return palette.border;
  return value;
}

export function themeStyleSheet(baseStyles, scheme, fontScale = 1) {
  return Object.fromEntries(Object.entries(baseStyles).map(([name, style]) => [
    name,
    Object.fromEntries(Object.entries(style).map(([property, value]) => [
      property, ['fontSize', 'lineHeight'].includes(property) && typeof value === 'number' ? Math.round(value * fontScale) : themeStyleColor(property, value, scheme),
    ])),
  ]));
}
