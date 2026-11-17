import { describe, expect, it } from 'vitest';
import { safeGallery, removeGalleryPhoto } from './gallery';
import { Element, htmlToDOM } from 'html-react-parser';
import { isCmsSlider, markupPhotos, sliderImages } from './slider-markup';
import { blockHtml } from './blocks';
import { cmsId, editableKind } from './content';

describe('safeGallery', () => {
  const photos = [{ src: '/a.jpg', alt: 'A' }, { src: '/b.jpg', alt: 'B' }, { src: '/c.jpg', alt: 'C' }];
  it('removes one or two photos while retaining order and playback settings', () => {
    const initial = safeGallery({ speed: 8, effect: 'fade', photos });
    const one = removeGalleryPhoto(initial, photos, 1);
    expect(one).toEqual({ folder: '', speed: 8, effect: 'fade', photos: [photos[0], photos[2]] });
    expect(removeGalleryPhoto(one, one.photos ?? [], 0).photos).toEqual([photos[2]]);
    expect(initial.photos).toEqual(photos);
  });
  it('removes a folder photo from the slider only and preserves an empty selection after saving', () => {
    const folder = safeGallery({ folder: '12345678-1234-1234-1234-123456789abc', speed: 8 });
    const next = removeGalleryPhoto(folder, photos, 0);
    expect(next.folder).toBe('');
    expect(next.photos).toEqual([photos[1], photos[2]]);
    expect(folder.folder).toBe('12345678-1234-1234-1234-123456789abc');
    expect(photos).toHaveLength(3);
    expect(safeGallery(JSON.parse(JSON.stringify(removeGalleryPhoto(next, photos.slice(2), 0)))).photos).toEqual([]);
  });
  it('keeps chosen speed and transition', () => {
    expect(safeGallery({ speed: 8, effect: 'fade' })).toMatchObject({ speed: 8, effect: 'fade' });
  });
  it('limits speed between 2 and 15 seconds', () => {
    expect(safeGallery({ speed: 0 }).speed).toBe(2);
    expect(safeGallery({ speed: 99 }).speed).toBe(15);
  });
  it('rejects unknown transitions and folder ids', () => {
    expect(safeGallery({ effect: 'spin', folder: 'x; drop' })).toMatchObject({ effect: 'slide', folder: '' });
  });
  it('preserves a chosen list, including an intentionally empty list', () => {
    expect(safeGallery({ photos: [{ src: '/cms-media/test.jpg', alt: 'Test' }] }).photos).toEqual([{ src: '/cms-media/test.jpg', alt: 'Test' }]);
    expect(safeGallery({ photos: [] }).photos).toEqual([]);
    expect(safeGallery({ photos: [{ src: 'javascript:alert(1)', alt: '' }] }).photos).toEqual([]);
  });
});

describe('imported header slider', () => {
  const html = '<div class="page"><section><div class="carousel" data-carousel_autoplay=""><article class="active"><div class="media-4"><img src="/a.jpg" alt="A"></div><h2>Heading</h2></article><article><div class="media-4"><img src="/b.jpg" alt="B"></div></article></div></section></div>';
  const root = htmlToDOM(html)[0] as Element;
  const section = root.children[0] as Element;
  const carousel = section.children[0] as Element;
  it('recognizes nested article photos but not ordinary card groups', () => {
    expect(editableKind(carousel)).toBe('gallery');
    expect(markupPhotos(carousel)).toEqual([{ src: '/a.jpg', alt: 'A' }, { src: '/b.jpg', alt: 'B' }]);
    expect(isCmsSlider(htmlToDOM('<div class="grid"><img src="/a.jpg"><img src="/b.jpg"></div>')[0] as Element)).toBe(false);
  });
  it('keeps old image positions available for existing overrides', () => {
    const image = sliderImages(carousel)[0];
    if (!image) throw new Error('Missing fixture photo');
    expect(cmsId(image)).toBe('c0-0-0-0-0-0');
  });
  it('copies speed, effect, folder and manual photos without losing article content', () => {
    const gallery = { speed: 8, effect: 'zoom' as const, folder: '12345678-1234-1234-1234-123456789abc', photos: [{ src: '/new.jpg', alt: 'New' }] };
    const copied = blockHtml(html, { o: 0 }, { [cmsId(carousel)]: { gallery } });
    const copiedSection = htmlToDOM(copied)[0] as Element;
    const copiedCarousel = copiedSection.children[0] as Element;
    expect(JSON.parse(copiedCarousel.attribs['data-gallery-settings'] ?? '{}')).toEqual(gallery);
    expect(markupPhotos(copiedCarousel)).toHaveLength(2);
  });
});
