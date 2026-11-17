import { sitePages as originalPages } from '@/site/cms-adapter';

export type SiteMedia = { url: string; name: string; folder: 'site' | 'icons'; type: string };

const extType: Record<string, string> = { png: 'PNG', jpg: 'JPG', jpeg: 'JPG', svg: 'SVG', webp: 'WebP', gif: 'GIF' };

/** All original images used on the website pages, deduplicated by URL. */
export const siteMedia: SiteMedia[] = (() => {
  const seen = new Map<string, SiteMedia>();
  for (const page of Object.values(originalPages as Record<string, { html: string }>)) {
    for (const m of page.html.matchAll(/<img[^>]*?\ssrc="([^"]+)"/g)) {
      const url = m[1]!;
      if (seen.has(url)) continue;
      const name = decodeURIComponent(url.split('/').pop() ?? url);
      const ext = (name.split('.').pop() ?? '').toLowerCase();
      const isIcon = ext === 'svg' || /icon|facebook|twitter|linkedin|menu/i.test(name);
      seen.set(url, { url, name, folder: isIcon ? 'icons' : 'site', type: extType[ext] ?? ext.toUpperCase() });
    }
  }
  return [...seen.values()];
})();
