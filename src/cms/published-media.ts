import { htmlToDOM, type DOMNode } from 'html-react-parser';
import { blockHtml, defaultLayout, isMovableBlock, type Layout } from './blocks.ts';
import { cmsId, type CmsContent } from './content.ts';
import { safeGallery } from './gallery.ts';
import { isCmsSlider } from './slider-markup.ts';

/** Collect only references in the rendered, published page, not removed/off blocks. */
export function publishedMediaReferences(html: string, content: CmsContent, layout: Layout | null) {
  const urls = new Set<string>();
  const folders = new Set<string>();
  const visit = (nodes: DOMNode[], baked = false) => {
    for (const node of nodes) {
      if (node.type !== 'tag') continue;
      const override = baked ? undefined : content[cmsId(node)];
      for (const value of [override?.src ?? node.attribs['src'], override?.href ?? node.attribs['href'], override?.bg]) if (value) urls.add(value);
      if (!override?.bg) for (const match of (node.attribs['style'] ?? '').matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(match[1]!);
      if (node.name === 'div' && (node.attribs['class'] ?? '').split(/\s+/).includes('page')) {
        for (const item of layout ?? defaultLayout(html)) if (!item.off) visit(htmlToDOM(blockHtml(html, item, content)), true);
        // Nonmovable children include fixed headers/footers.
        for (const child of node.children) if (!isMovableBlock(child)) visit([child as DOMNode], baked);
        continue;
      }
      if (override?.html) { visit(htmlToDOM(override.html), true); continue; }
      if (isCmsSlider(node)) {
        let embedded = {};
        try { embedded = JSON.parse(node.attribs['data-gallery-settings'] ?? '{}'); } catch { /* fail closed */ }
        const gallery = safeGallery({ folder: node.attribs['data-folder'], ...embedded, ...override?.gallery });
        if (gallery.folder) folders.add(gallery.folder);
        for (const photo of gallery.photos ?? []) urls.add(photo.src);
      }
      visit(node.children as DOMNode[], baked);
    }
  };
  visit(htmlToDOM(html));
  return { urls, folders };
}