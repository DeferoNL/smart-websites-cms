import type { Element } from 'html-react-parser';
import type { GalleryPhoto } from './gallery.ts';

export function sliderArticles(el: Element): Element[] {
  return el.children.filter((n): n is Element => n.type === 'tag' && 'name' in n && n.name === 'article');
}
export function sliderImages(el: Element): Element[] {
  return el.children.flatMap(n => n.type === 'tag' && 'name' in n ? n.name === 'img' ? [n as Element] : sliderImages(n as Element) : []);
}
/** Only explicit galleries or known photo carousels, never arbitrary groups of images. */
export function isCmsSlider(el: Element): boolean {
  return el.name === 'div' && (el.attribs['data-cms-gallery'] !== undefined ||
    (/(^|\s)carousel(\s|$)/.test(el.attribs['class'] ?? '') && sliderArticles(el).length > 1 && sliderArticles(el).every(a => sliderImages(a).length > 0)));
}
export function markupPhotos(el: Element): GalleryPhoto[] {
  const articles = sliderArticles(el);
  const images = articles.length ? articles.flatMap(a => sliderImages(a).slice(0, 1)) : sliderImages(el);
  return images.map(i => ({ src: i.attribs['src'] ?? '', alt: i.attribs['alt'] ?? '' }));
}