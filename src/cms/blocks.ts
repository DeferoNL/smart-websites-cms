// Section ("block") layout helpers. Browser- and server-safe; copyable to other projects.
import { htmlToDOM, Element } from 'html-react-parser';
import render from 'dom-serializer';
import { applyBlockAppearance, applyBlockBackground, type BlockAppearance } from './block-background.ts';
import { cmsId, cssOf, editableKind, imageShapeStyle, safeHref, safePosition, withBackground, buttonColorStyle, type CmsContent } from './content.ts';

/** An original section of the page (by index) or a copied instance with its own markup. */
export type BlockItem = ({ o: number } | { i: string; html: string; v?: string }) & { off?: boolean; appearance?: BlockAppearance };
export type Layout = BlockItem[];

const LOCKED = new Set(['header', 'nav', 'footer']);
type N = { type?: string; name?: string; attribs?: Record<string, string>; children?: N[] };

function hasLocked(n: N): boolean {
  return (n.children ?? []).some(c => (c.type === 'tag' && LOCKED.has(c.name ?? '')) || hasLocked(c));
}
// Site-wide fixed strips (cookie banner, spacers, contact bar, copyright) are never content blocks.
const FIXED = /\bblock-(121|47|48|55)-\d+\b/;
/** Sections directly under the page wrapper that may be moved, copied or removed. */
export function isMovableBlock(n: unknown): n is Element {
  const e = n as N;
  return e?.type === 'tag' && e.name === 'section' && !hasLocked(e) && !FIXED.test(e.attribs?.['class'] ?? '');
}
export const isPageWrapper = (n: Element) => n.name === 'div' && (n.attribs['class'] ?? '').split(/\s+/).includes('page');

export const blockKey = (b: BlockItem) => ('o' in b ? `o${b.o}` : b.i);
export const newInstanceId = () => 'b' + Math.random().toString(36).slice(2, 10);

/** Short content hash, so translations of unchanged copied blocks can be reused. */
export function hashHtml(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function defaultLayout(pageHtml: string): Layout {
  const wrapper = findWrapper(htmlToDOM(clean(pageHtml)) as unknown as N[]);
  const count = wrapper ? (wrapper.children ?? []).filter(isMovableBlock).length : 0;
  return Array.from({ length: count }, (_, o) => ({ o }));
}

export function moveBlock(layout: Layout, index: number, dir: -1 | 1): Layout {
  const j = index + dir;
  if (j < 0 || j >= layout.length) return layout;
  const out = [...layout];
  [out[index], out[j]] = [out[j]!, out[index]!];
  return out;
}
export function insertBlock(layout: Layout, index: number, html: string): Layout {
  const out = [...layout];
  out.splice(index, 0, { i: newInstanceId(), html, v: hashHtml(html) });
  return out;
}
/** Temporarily switches a block off (still visible in the editor, never published) or back on. */
export const toggleBlock = (layout: Layout, index: number): Layout => layout.map((b, i) => (i === index ? { ...b, off: !b.off } : b));
export const removeBlock = (layout: Layout, index: number): Layout => layout.filter((_, i) => i !== index);
export const updateBlockBackground = (layout: Layout, index: number, appearance?: BlockAppearance): Layout => layout.map((b, i) => {
  if (i !== index) return b;
  const out = { ...b };
  if (appearance) out.appearance = appearance; else delete out.appearance;
  return out;
});

/** Built-in announcement block colors; always present in the library and never deletable. */
export const ANNOUNCEMENT_COLORS = { Rood: '#c62828', Groen: '#2e7d32', Blauw: '#1565c0', Oranje: '#ef6c00', Donker: '#222222' } as const;
export function announcementHtml(color: string) {
  return `<section class="cms-announcement" style="background:${color};color:#ffffff;padding:60px 20px;text-align:center"><div class="container"><div style="max-width:800px;margin:0 auto"><h2 style="color:#ffffff;margin:0 0 16px">Mededeling</h2><p style="color:#ffffff;margin:0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pas deze tekst aan voor bijvoorbeeld een vakantiemelding.</p></div></div></section>`;
}
/** Users must type this exact word before a block is removed. */
export const isDeleteConfirmed = (s: string) => s.trim().toLowerCase() === 'verwijderen';

const clean = (html: string) => html.replace(/<\/br\s*>/gi, '');
function findWrapper(nodes: N[]): N | null {
  for (const n of nodes) {
    if (n.type !== 'tag') continue;
    if (isPageWrapper(n as unknown as Element)) return n;
    const f = findWrapper(n.children ?? []);
    if (f) return f;
  }
  return null;
}

function applyOverrides(nodes: N[], content: CmsContent, prefix: string) {
  for (const n of nodes) {
    if (n.type !== 'tag') continue;
    const kind = editableKind(n as unknown as Element);
    const o = kind ? content[prefix + cmsId(n as unknown as Element)] : undefined;
    if (o && n.attribs) {
      if (kind === 'image') {
        if (o.src) { n.attribs['src'] = o.src; delete n.attribs['srcset']; delete n.attribs['sizes']; }
        if (o.alt !== undefined) n.attribs['alt'] = o.alt;
        const pos = safePosition(o.position);
        if (pos) n.attribs['style'] = `${(n.attribs['style'] ?? '').replace(/object-position:[^;]*;?/g, '')};object-position:${pos}`.replace(/^;/, '');
        const shape = cssOf(imageShapeStyle(o));
        if (shape) n.attribs['style'] = `${n.attribs['style'] ?? ''};${shape}`.replace(/^;/, '');
      } else if (kind === 'background') {
        n.attribs['style'] = withBackground(n.attribs['style'] ?? '', o);
      } else if (kind === 'gallery' && o.gallery) {
        n.attribs['data-gallery-settings'] = JSON.stringify(o.gallery);
      } else {
        if (o.html !== undefined) n.children = htmlToDOM(o.html) as unknown as N[];
        if (kind === 'link') {
          const colors = cssOf(buttonColorStyle(o));
          if (colors) n.attribs['style'] = `${n.attribs['style'] ?? ''};${colors}`.replace(/^;/, '');
          if (o.href !== undefined) n.attribs['href'] = safeHref(o.href);
          if (o.target) n.attribs['target'] = o.target; else if (o.target === '') delete n.attribs['target'];
        }
      }
    }
    applyOverrides(n.children ?? [], content, prefix);
  }
}

/** Markup of a block with its current edits baked in, for copying or saving to the library. */
export function blockHtml(pageHtml: string, item: BlockItem, content: CmsContent): string {
  if ('i' in item) {
    const dom = htmlToDOM(item.html) as unknown as N[];
    applyOverrides(dom, content, item.i + ':');
    const html = render(dom as never);
    return item.appearance ? applyBlockBackground(html, item.appearance) : html;
  }
  const dom = htmlToDOM(clean(pageHtml)) as unknown as N[];
  applyOverrides(dom, content, '');
  const section = (findWrapper(dom)?.children ?? []).filter(isMovableBlock)[item.o];
  if (section) applyBlockAppearance(section, item.appearance);
  return section ? render(section as never) : '';
}

/** Keeps inserted block content inside the site's own content width: wraps a section's children in `.container` when it has none. */
export function ensureContainer(html: string): string {
  const nodes = htmlToDOM(html) as unknown as N[];
  const root = nodes.find(n => n.type === 'tag' && n.name === 'section');
  if (!root) return html;
  const hasContainer = (root.children ?? []).some(c => c.type === 'tag' && (c.attribs?.['class'] ?? '').split(/\s+/).includes('container'));
  if (hasContainer) return html;
  const inner = render((root.children ?? []) as never);
  const open = render({ ...root, children: [] } as never).replace(/<\/section>$/, '');
  return `${open}<div class="container"><div class="row"><div class="col"><div class="box">${inner}</div></div></div></div></section>`;
}
