import originalPages from '@/site/pages.json';
import { publishedMediaReferences } from '../cms/published-media.ts';
import type { CmsContent } from '../cms/content.ts';
import type { Layout } from '../cms/blocks.ts';
import { publicClient, readPublicCmsPageData } from './cms.functions.ts';

/** Authorization uses current rendered published content, including original slider markup. */
export async function publishedMediaAccess() {
  const [pages, edits] = await Promise.all([readPublicCmsPageData(), publicClient().from('page_content').select('path,data,layout').eq('state', 'published')]);
  if (edits.error) throw new Error('Foto’s konden niet worden geladen.');
  const urls = new Set(pages.seo.map(s => s.og_image).filter((s): s is string => !!s));
  const folders = new Set<string>();
  const sources = Object.fromEntries(pages.custom.map(c => [c.path, c.source_path]));
  for (const page of new Set([...Object.keys(originalPages), ...Object.keys(sources)])) {
    if (pages.settings.some(s => s.path === page && (s.disabled || s.deleted))) continue;
    const original = (originalPages as Record<string, { html: string }>)[sources[page] ?? page];
    if (!original) continue;
    const edit = edits.data?.find(e => e.path === page);
    const refs = publishedMediaReferences(original.html, (edit?.data ?? {}) as CmsContent, edit?.layout as Layout | null);
    for (const url of refs.urls) urls.add(url);
    for (const folder of refs.folders) folders.add(folder);
  }
  return { urls, folders };
}

export async function publishedFolderPhotos(folder: string) {
  const refs = await publishedMediaAccess();
  if (!refs.folders.has(folder)) return [];
  // Privileged read is permitted only after the folder is proven published; no library metadata.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('media').select('url,alt').eq('folder_id', folder).eq('kind', 'image').order('created_at').order('id');
  if (error) throw new Error('Foto’s konden niet worden geladen.');
  return data ?? [];
}