// Pure helpers to carry edits from a page to its counterpart in another language.
import { htmlToDOM, Element } from 'html-react-parser';
import { cmsId, editableKind, type CmsContent } from './content.ts';
import { sitePages as originalPages } from '@/site/cms-adapter';
import { cmsPath, publicPath, siteLanguage } from './languages.ts';

type Pages = Record<string, { html: string }>;
const pages = originalPages as unknown as Pages;

export const langOf = siteLanguage;

/** The page in `lang` that this page's language switch points to. */
const PAIRS: [string, string][] = [];

/** Dashboard-created pages: path -> counterpart path and path -> original page whose markup it uses. */
export type CustomMap = { pairs?: Record<string, string>; sources?: Record<string, string> };

export function counterpart(path: string, lang: string, custom?: CustomMap): string | null {
  const cp = custom?.pairs?.[path];
  if (cp) return langOf(cp) === lang ? cp : null;
  for (const pair of PAIRS) { const i = pair.indexOf(path); if (i >= 0) { const o = pair[1 - i]!; return langOf(o) === lang ? o : null; } }
  const html = pages[path]?.html;
  if (!html) return null;
  const re = new RegExp(`href="(/${lang}(?:/[^"]*)?)"`);
  const m = html.match(re)?.[1]?.replace(/\/+$/, '');
  return m && pages[m] ? m : null;
}

/** Map of editable element ids to their kind on a page, as BMPage assigns them. */
export function editableIds(path: string, custom?: CustomMap): Map<string, string> {
  const out = new Map<string, string>();
  const html = pages[custom?.sources?.[path] ?? path]?.html;
  if (!html) return out;
  const walk = (nodes: unknown[]) => {
    for (const n of nodes) {
      if ((n as { type?: string }).type === 'tag') {
        const k = editableKind(n as Element);
        if (k) out.set(cmsId(n as Element), k);
        walk((n as Element).children as unknown[]);
      }
    }
  };
  walk(htmlToDOM(html.replace(/<\/br\s*>/gi, '')) as unknown[]);
  return out;
}

/** Rewrites an internal page link to the target language's page. */
export function mapHref(href: string, lang: string, custom?: CustomMap) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const p = cmsPath(href);
  if (!pages[p] && !custom?.pairs?.[p]) return href;
  const target = counterpart(p, lang, custom);
  return target ? publicPath(target) : href;
}

/** Overrides that can be carried over: same id and same kind on the target page. */
export function transferable(source: CmsContent, fromPath: string, toPath: string, custom?: CustomMap): CmsContent {
  const a = editableIds(fromPath, custom), b = editableIds(toPath, custom);
  const out: CmsContent = {};
  for (const [id, o] of Object.entries(source)) if (a.get(id) && a.get(id) === b.get(id)) out[id] = o;
  return out;
}
