import { describe, expect, it } from 'vitest';
import { publishedMediaReferences } from './published-media';
import { cmsId } from './content';
import { htmlToDOM, Element } from 'html-react-parser';

describe('published media authorization', () => {
  const html = '<header><img src="/cms-media/logo.png"></header><div class="page"><section><img src="/cms-media/a.png"></section><section><img src="/cms-media/b.png"></section></div>';
  it('keeps fixed website media but excludes removed and switched-off sections', () => {
    const refs = publishedMediaReferences(html, {}, [{ o: 0, off: true }]);
    expect([...refs.urls]).toEqual(['/cms-media/logo.png']);
  });
  it('recognizes copied block photos and encoded slider settings', () => {
    const folder = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const refs = publishedMediaReferences(html, {}, [{ i: 'copy', html: `<section><div data-cms-gallery="" data-gallery-settings="{&quot;folder&quot;:&quot;${folder}&quot;,&quot;photos&quot;:[{&quot;src&quot;:&quot;/cms-media/copied.png&quot;,&quot;alt&quot;:&quot;&quot;}]}" /></section>` }]);
    expect(refs.urls.has('/cms-media/copied.png')).toBe(true);
    expect(refs.folders.has(folder)).toBe(true);
    expect(refs.urls.has('/cms-media/a.png')).toBe(false);
  });
  it('applies original image overrides without authorizing stale photos', () => {
    const original = '<header><img src="/cms-media/old.png"></header>';
    const header = htmlToDOM(original)[0] as Element;
    const image = header.children[0] as Element;
    const refs = publishedMediaReferences(original, { [cmsId(image)]: { src: '/cms-media/new.png' } }, null);
    expect([...refs.urls]).toEqual(['/cms-media/new.png']);
  });
  it('keeps page-wrapper background overrides', () => {
    const original = '<div class="page" style="background-image:url(/cms-media/old.png)"><section>Text</section></div>';
    const wrapper = htmlToDOM(original)[0] as Element;
    const refs = publishedMediaReferences(original, { [cmsId(wrapper)]: { bg: '/cms-media/new.png' } }, null);
    expect([...refs.urls]).toEqual(['/cms-media/new.png']);
  });
});