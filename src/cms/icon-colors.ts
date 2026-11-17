export const DEFAULT_ICON_COLOR = '#1f2937';

export const ICON_COLORS = [
  { name: 'Donkergrijs', color: DEFAULT_ICON_COLOR },
  { name: 'Zwart', color: '#000000' },
  { name: 'Wit', color: '#ffffff' },
  { name: 'Blauw', color: '#2563eb' },
  { name: 'Groen', color: '#16a34a' },
  { name: 'Rood', color: '#dc2626' },
];

export function isIconColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Keep the original SVG geometry; only replace its configurable paint. */
export function coloredIconUrl(svg: string, color: string): string {
  const paint = isIconColor(color) ? color : DEFAULT_ICON_COLOR;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/currentColor/g, paint))}`;
}