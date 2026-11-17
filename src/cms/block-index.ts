// Indexes the movable blocks already on the website into library templates. Browser- and server-safe.
import { htmlToDOM, type Element } from 'html-react-parser';
import render from 'dom-serializer';
import { isMovableBlock, isPageWrapper } from './blocks.ts';

export const BLOCK_CATEGORIES = [
  ['hero', 'Hero'], ['diensten', 'Diensten'], ['collecties', 'Collecties'], ['content', 'Content'],
  ['galerij', 'Galerij'], ['prijzen', 'Prijzen'], ['reviews', 'Reviews'], ['team', 'Team'], ['faq', 'FAQ'],
  ['usps', "USP's"], ['formulieren', 'Formulieren & Contact'], ['cta', 'CTA'], ['footer', 'Footers'], ['overig', 'Overig'],
] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number][0];
export const categoryLabel = (c: string) => BLOCK_CATEGORIES.find(([k]) => k === c)?.[1] ?? 'Overig';

type N = { type?: string; name?: string; attribs?: Record<string, string>; children?: N[]; data?: string };

function wrapperOf(nodes: N[]): N | null {
  for (const n of nodes) {
    if (n.type !== 'tag') continue;
    if (isPageWrapper(n as unknown as Element)) return n;
    const f = wrapperOf(n.children ?? []);
    if (f) return f;
  }
  return null;
}

/** Movable sections of a page (header, nav, footer and fixed strips excluded). */
export function extractBlocks(pageHtml: string, resolve?: (section: Element, index: number) => { background: string; color: string } | undefined): string[] {
  const w = wrapperOf(htmlToDOM(pageHtml.replace(/<\/br\s*>/gi, '')) as unknown as N[]);
  return (w?.children ?? []).filter(isMovableBlock).map((s, i) => {
    const appearance = resolve?.(s, i);
    if (appearance) {
      s.attribs['style'] = `${s.attribs['style'] ?? ''};background-color:${appearance.background};color:${appearance.color}`.replace(/^;/, '');
    }
    return render(s as never);
  });
}

/** Structure-only key (tags + classes), so the same block with other text/images is not duplicated. */
export function fingerprint(html: string): string {
  const walk = (ns: N[]): string => ns.filter(n => n.type === 'tag').map(n => `${n.name}.${(n.attribs?.['class'] ?? '').trim().split(/\s+/).sort().join('.')}(${walk(n.children ?? [])})`).join('');
  const s = walk(htmlToDOM(html) as unknown as N[]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'f' + (h >>> 0).toString(36) + s.length.toString(36);
}

export function categorize(html: string, path = ''): BlockCategory {
  const h = html.toLowerCase();
  const cls = (h.match(/class="[^"]*"/g) ?? []).join(' ');
  const has = (re: RegExp) => re.test(cls);
  const imgs = (h.match(/<img\b/g) ?? []).length;
  const cards = (h.match(/class="[^"]*\b(card|item|tile)\b/g) ?? []).length;
  if (has(/hero|banner/) || (/<h1\b/.test(h) && /background-image/.test(h))) return 'hero';
  if (has(/footer/)) return 'footer';
  if (/<form\b/.test(h) || has(/form|contact/)) return 'formulieren';
  if (has(/price|pricing|prijs/) || /€\s?\d/.test(h)) return 'prijzen';
  if (has(/faq/) || /<details\b/.test(h)) return 'faq';
  if (has(/review|testimonial/) || /★/.test(h)) return 'reviews';
  if (has(/team/)) return 'team';
  if (has(/usp|feature|voordel/)) return 'usps';
  if (has(/cta/)) return 'cta';
  if (has(/gallery|galerij/) || (imgs >= 4 && cards === 0)) return 'galerij';
  if (cards >= 2 || has(/grid|cards/)) return /dienst|service/.test(path) || has(/service|dienst/) ? 'diensten' : 'collecties';
  if (/<h[1-6]\b/.test(h) || has(/text/)) return 'content';
  return 'overig';
}

export type IndexedBlock = { name: string; html: string; category: BlockCategory; fingerprint: string; source_path: string };

/** Unique blocks across all pages, first occurrence wins. */
export function indexSite(pages: Record<string, { html: string; title?: string }>, resolve?: (path: string, section: Element, index: number) => { background: string; color: string } | undefined): IndexedBlock[] {
  const seen = new Map<string, IndexedBlock>();
  for (const [path, page] of Object.entries(pages)) {
    for (const html of extractBlocks(page.html, (section, index) => resolve?.(path, section, index))) {
      const fp = fingerprint(html);
      if (seen.has(fp)) continue;
      const category = categorize(html, path);
      const heading = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
      const pageName = (page.title ?? path).split(' - ')[0];
      seen.set(fp, { name: `${categoryLabel(category)} – ${heading || 'blok'} (${pageName})`.slice(0, 120), html, category, fingerprint: fp, source_path: path });
    }
  }
  return [...seen.values()];
}
