import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { CmsContent } from '../cms/content.ts';
import type { Layout } from '../cms/blocks.ts';
import { DEFAULT_SITE_LANGUAGES, type SiteLanguages } from '../cms/languages.ts';
import type { PublicCmsPageData } from './public-cms-data.ts';

function publicClient(bearer?: string) {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization');
        h.set('apikey', key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
export { publicClient };

export async function readPublicCmsPageData(): Promise<PublicCmsPageData> {
  const { data, error } = await publicClient().rpc('public_cms_page_data');
  if (error) throw new Error('Websitegegevens konden niet worden geladen.');
  return data as unknown as PublicCmsPageData;
}

export const getSiteLanguages = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().rpc('public_site_languages');
  if (error) throw new Error('Taalinstellingen konden niet worden geladen.');
  return (data ?? DEFAULT_SITE_LANGUAGES) as SiteLanguages;
});

export type SiteLook = { social: Record<string, string>; menu_icon_color: string };
// Public look-and-feel settings: social media URLs and the hamburger icon colour.
export const getSiteLook = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().rpc('public_site_look');
  if (error) { console.error(error); return { social: {}, menu_icon_color: '' } as SiteLook; }
  return (data ?? { social: {}, menu_icon_color: '' }) as SiteLook;
});

// Published page edits, read during SSR so visitors and crawlers see them.
export const getPublishedContent = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { data, error } = await publicClient().from('page_content').select('path, data').eq('state', 'published');
    if (error) { console.error(error); return {} as Record<string, CmsContent>; }
    const map: Record<string, CmsContent> = {};
    for (const row of data ?? []) map[row.path] = (row.data ?? {}) as CmsContent;
    return map;
  } catch (error) {
    console.error(error);
    return {} as Record<string, CmsContent>;
  }
});

// Published block layouts (order, copies, removals) per page.
export const getPublishedLayouts = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { data, error } = await publicClient().from('page_content').select('path, layout').eq('state', 'published').not('layout', 'is', null);
    if (error) { console.error(error); return {} as Record<string, Layout>; }
    const map: Record<string, Layout> = {};
    for (const row of data ?? []) if (Array.isArray(row.layout)) map[row.path] = row.layout as unknown as Layout;
    return map;
  } catch (error) {
    console.error(error);
    return {} as Record<string, Layout>;
  }
});

// Pages created in the dashboard: new path -> original page whose markup it reuses.
export const getCustomPages = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { custom: data } = await readPublicCmsPageData();
    return Object.fromEntries((data ?? []).map(r => [r.path, r.source_path])) as Record<string, string>;
  } catch (error) {
    console.error(error);
    return {} as Record<string, string>;
  }
});
