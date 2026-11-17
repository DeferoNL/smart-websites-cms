// Website appearance is validated content, independent of the CMS theme.
import { htmlToDOM, Element } from 'html-react-parser';
import render from 'dom-serializer';
import { safeButtonColor } from './content.ts';

export type BlockAppearance = { background: string; color?: string };
export const BACKGROUND_PRESETS = [
  { name: 'Transparant', hex: '#000000', opacity: 0 },
  { name: 'Donker glas', hex: '#171717', opacity: 85 },
  { name: 'Volledig zwart', hex: '#000000', opacity: 100 },
  { name: 'Licht glas', hex: '#ffffff', opacity: 90 },
  { name: 'Volledig wit', hex: '#ffffff', opacity: 100 },
] as const;

/** Opacity is coverage: 0 = transparent, 100 = opaque; text is never faded. */
export function hexToRgba(hex: string, opacity: number): string | undefined {
  const color = safeButtonColor(hex);
  if (!color || !Number.isFinite(opacity)) return undefined;
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  return `rgba(${rgb.join(', ')}, ${Math.min(100, Math.max(0, opacity)) / 100})`;
}

export function safeBackground(value: string): string | undefined {
  if (value === 'transparent') return value;
  const hex = safeButtonColor(value);
  if (hex) return hex;
  const m = /^rgba\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/.exec(value);
  return m && m.slice(1, 4).every(v => Number(v) <= 255) ? value : undefined;
}

export function contrastColor(hex: string): string {
  const color = safeButtonColor(hex) ?? '#ffffff';
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
  return luminance > 0.179 ? '#1f2937' : '#ffffff';
}

export function applyBlockAppearance(node: Element, appearance?: BlockAppearance): void {
  const background = appearance && safeBackground(appearance.background);
  if (node.name !== 'section' || !background) return;
  const style = (node.attribs['style'] ?? '').replace(/(?:^|;)\s*background-color\s*:[^;]*/gi, '');
  const color = safeButtonColor(appearance?.color);
  const previous = node.attribs['data-cms-block-contrast'];
  const base = previous ? style.replace(/(?:^|;)\s*color\s*:[^;]*/gi, '') : style;
  if (color && !previous) node.attribs['data-cms-block-original-color'] = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1] ?? '';
  const restored = !color && previous ? node.attribs['data-cms-block-original-color'] : undefined;
  node.attribs['style'] = `${base};background-color:${background}${color ? `;color:${color}` : restored ? `;color:${restored}` : ''}`.replace(/^;/, '');
  if (color) node.attribs['data-cms-block-contrast'] = color;
  else { delete node.attribs['data-cms-block-contrast']; delete node.attribs['data-cms-block-original-color']; }
}

/** Only the root section changes; unrelated inline declarations survive. */
export function applyBlockBackground(html: string, appearance: BlockAppearance): string {
  const dom = htmlToDOM(html);
  const root = dom.find(n => n.type === 'tag') as Element | undefined;
  if (!root || root.name !== 'section' || !safeBackground(appearance.background)) return html;
  applyBlockAppearance(root, appearance);
  return render(dom);
}