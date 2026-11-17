// Shared, browser- and server-safe CMS helpers. Copyable to other projects.
import type { Element } from 'html-react-parser';
import { cmsPath } from './languages.ts';
import { isCmsSlider } from './slider-markup.ts';
import type { GallerySettings } from './gallery.ts';

export type ImageShape = '' | 'landscape' | 'portrait' | 'square' | 'round';
export type CmsOverride = { html?: string; src?: string; srcset?: string | null; alt?: string; position?: string; href?: string; target?: string; link?: string; shape?: ImageShape; rounded?: boolean; bg?: string; buttonBackground?: string; buttonForeground?: string; gallery?: Partial<GallerySettings> };
export type CmsContent = Record<string, CmsOverride>;

/** Website colors are user content, validated independently of the CMS theme. */
export function safeButtonColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}
export function buttonColorStyle(o: Pick<CmsOverride, 'buttonBackground' | 'buttonForeground'> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const bg = safeButtonColor(o?.buttonBackground); const fg = safeButtonColor(o?.buttonForeground);
  if (bg) out['backgroundColor'] = bg;
  if (fg) out['color'] = fg;
  return out;
}
export function colorInputValue(value: string): string | undefined {
  const hex = safeButtonColor(value);
  if (hex) return hex;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/.exec(value);
  return rgb ? '#' + rgb.slice(1, 4).map(v => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('') : undefined;
}

const TEXT_CLASS = /(^|\s)(heading|text)-\d+(\s|$)/;
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const LOCKED = new Set(['nav', 'form', 'button', 'a']);

type Node = { type?: string; name?: string; attribs?: Record<string, string>; parent?: unknown; prev?: unknown };
const asEl = (n: unknown) => n as Node | null | undefined;
const isEl = (n: Node | null | undefined) => !!n && (n.type === 'tag' || n.type === 'script' || n.type === 'style');

/** Stable id from the element's position in the original page markup. */
export function cmsId(el: Element): string {
  const parts: number[] = [];
  let n: Node | null | undefined = el as unknown as Node;
  while (n) {
    let i = 0;
    for (let p = asEl(n.prev); p; p = asEl(p.prev)) if (isEl(p)) i++;
    parts.unshift(i);
    n = asEl(n.parent);
  }
  return 'c' + parts.join('-');
}

export function isTextBlock(el: { name: string; attribs: Record<string, string> }) {
  return HEADINGS.has(el.name) || (el.name === 'div' && TEXT_CLASS.test(el.attribs['class'] ?? ''));
}

/** Text blocks are editable unless nested in another block or in menus/forms/links. */
export function editableKind(el: Element): 'text' | 'image' | 'link' | 'background' | 'gallery' | null {
  if (isCmsSlider(el)) return 'gallery';
  for (let p = asEl(el.parent); p; p = asEl(p.parent)) {
    if (!p.name) continue;
    if (p.attribs?.['data-cms-gallery'] !== undefined) return null;
    // Photos inside a link (e.g. a logo) stay editable; the link becomes the photo's link.
    if (LOCKED.has(p.name) && !(el.name === 'img' && p.name === 'a')) return null;
    if (p.attribs && isTextBlock(p as { name: string; attribs: Record<string, string> })) return null;
  }
  if (el.name === 'img') return 'image';
  if (el.name === 'a' && el.attribs['href'] !== undefined && !el.attribs['class']?.includes('handler') && !('data-language-pending' in el.attribs) && isLabelOnly(el)) return 'link';
  if (isTextBlock(el)) return 'text';
  return (el.name === 'section' || el.name === 'div') && /background-image\s*:\s*url\(/i.test(el.attribs['style'] ?? '') ? 'background' : null;
}

/** Inline style for the chosen photo shape and corners. */
export function imageShapeStyle(o: Pick<CmsOverride, 'shape' | 'rounded'> | undefined): Record<string, string> {
  const s: Record<string, string> = {};
  const ratio = ({ landscape: '4 / 3', portrait: '3 / 4', square: '1 / 1', round: '1 / 1' } as Record<string, string>)[o?.shape || ''];
  if (ratio) { s['aspectRatio'] = ratio; s['objectFit'] = 'cover'; s['height'] = 'auto'; }
  if (o?.shape === 'round') s['borderRadius'] = '50%'; else if (o?.rounded) s['borderRadius'] = '16px';
  return s;
}
export const cssOf = (s: Record<string, string>) => Object.entries(s).map(([k, v]) => `${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}:${v}`).join(';');

/** Replaces the background photo (and optional alignment) in an inline style string. */
export function withBackground(style: string, o: CmsOverride | undefined): string {
  let out = style;
  if (o?.bg) out = out.replace(/background-image\s*:\s*url\([^)]*\)/i, `background-image:url(${o.bg.replace(/[()"'\s]/g, encodeURIComponent)})`);
  const pos = safePosition(o?.position);
  if (pos) out = `${out.replace(/background-position:[^;]*;?/g, '')};background-position:${pos}`.replace(/^;/, '');
  return out;
}

/** A link is editable as a button when it only holds text (no images or blocks). */
function isLabelOnly(el: Element) {
  const walk = (n: Node & { children?: unknown[] }): boolean => (n.children ?? []).every(c => { const k = asEl(c) as Node & { children?: unknown[]; data?: string }; return k?.type === 'text' || (k?.type === 'tag' && ['span', 'strong', 'b', 'em', 'i', 'br'].includes(k.name ?? '') && walk(k)); });
  return walk(el as unknown as Node & { children?: unknown[] }) && /\S/.test(textOf(el as unknown as Node));
}
function textOf(n: Node & { children?: unknown[]; data?: string }): string { return n.type === 'text' ? n.data ?? '' : (n.children ?? []).map(c => textOf(asEl(c) as Node)).join(''); }

export function mergeContent(base: CmsContent, patch: CmsContent): CmsContent {
  const out: CmsContent = { ...base };
  for (const [id, o] of Object.entries(patch)) out[id] = { ...out[id], ...o };
  return out;
}

/** Normalises a browser path to the page key used in pages.json. */
export function pageKey(pathname: string) {
  return cmsPath(pathname);
}

/** Only web, mail, phone, in-page and site-relative links; anything else (javascript:, data:, …) becomes '#'. */
export function safeHref(href: string | undefined | null): string {
  const h = (href ?? '').trim();
  if (!h) return '#';
  if (/^(https?:|mailto:|tel:)/i.test(h) || /^[/#?]/.test(h) && !h.startsWith('//')) return h;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(h) && !h.startsWith('//')) return h;
  return '#';
}

/** The 9 allowed photo alignments (CSS object-position). Anything else is ignored. */
export const IMAGE_POSITIONS = ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom'] as const;
export function safePosition(p: string | undefined | null): string | undefined {
  return p && (IMAGE_POSITIONS as readonly string[]).includes(p) ? p : undefined;
}
