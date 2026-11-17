import { createServerFn } from '@tanstack/react-start';
import { readPublicCmsPageData } from './cms.functions.ts';

export type SeoOverride = { title: string | null; description: string | null; noindex: boolean; nofollow: boolean; keywords?: string | null; canonical?: string | null; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null };

// Public read of page SEO overrides, used during SSR so crawlers see them.
export const getSeoOverrides = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { seo: data } = await readPublicCmsPageData();
    const map: Record<string, SeoOverride> = {};
    for (const row of data ?? []) map[row.path] = { title: row.title, description: row.description, noindex: row.noindex, nofollow: row.nofollow, keywords: row.keywords, canonical: row.canonical, ogTitle: row.og_title, ogDescription: row.og_description, ogImage: row.og_image };
    return map;
  } catch (error) {
    console.error(error);
    return {} as Record<string, SeoOverride>;
  }
});

/** Old address -> current page address, from the 301 redirect lines in page_seo. */
export function redirectMap(rows: { path: string; redirects: string | null }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) for (const line of (r.redirects ?? '').split(/\r?\n/)) {
    let from = line.trim(); if (!from) continue;
    try { if (/^https?:/i.test(from)) from = new URL(from).pathname; } catch { continue; }
    if (!from.startsWith('/')) from = '/' + from;
    from = from.replace(/\/+$/, '') || '/';
    if (from !== r.path) out[from] = r.path;
  }
  return out;
}

export const getRedirects = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { seo: data } = await readPublicCmsPageData();
    return redirectMap(data ?? []);
  } catch (error) { console.error(error); return {} as Record<string, string>; }
});

export type PageSetting = { name: string | null; hidden: boolean; disabled?: boolean; encrypted?: boolean; deleted?: boolean; order?: number | null; parent?: string | null };

// Public read of page names/menu visibility, merged into the menu during SSR.
export const getPageSettings = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { settings: data } = await readPublicCmsPageData();
    const map: Record<string, PageSetting> = {};
    for (const r of data ?? []) map[r.path] = { name: (r.path.startsWith('/en') ? r.name_en : r.name_nl) || null, hidden: r.hidden_in_menu || r.disabled || r.encrypted_url || r.deleted, deleted: r.deleted, disabled: r.disabled, encrypted: r.encrypted_url, order: r.sort_order, parent: r.parent_path };
    return map;
  } catch (error) {
    console.error(error);
    return {} as Record<string, PageSetting>;
  }
});
