import { describe, expect, it } from 'vitest';
import { htmlToDOM, Element } from 'html-react-parser';
import { applyBlockBackground, BACKGROUND_PRESETS, contrastColor, hexToRgba } from './block-background';
import { blockHtml, updateBlockBackground, type Layout } from './blocks';
import { indexSite } from './block-index';
import { STARTER_BLOCKS } from './starter-blocks';

const sectionOf = (html: string) => {
  const root = htmlToDOM(html).find(n => n.type === 'tag') as Element | undefined;
  if (!root) throw new Error('Missing section');
  return root;
};
describe('block backgrounds', () => {
  it('converts hex to rgba with coverage 0 through 100, without fading text', () => {
    expect(hexToRgba('#171717', 85)).toBe('rgba(23, 23, 23, 0.85)');
    expect(hexToRgba('#ffffff', 90)).toBe('rgba(255, 255, 255, 0.9)');
    expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    expect(hexToRgba('#ffffff', 100)).toBe('rgba(255, 255, 255, 1)');
  });
  it('has exactly the five requested preset values', () => {
    expect(BACKGROUND_PRESETS.map(p => [p.hex, p.opacity])).toEqual([['#000000', 0], ['#171717', 85], ['#000000', 100], ['#ffffff', 90], ['#ffffff', 100]]);
  });
  it('rejects injected CSS and invalid colors', () => {
    expect(hexToRgba('#fff;display:none', 90)).toBeUndefined();
    const html = '<section><p>Text</p></section>';
    expect(applyBlockBackground(html, { background: 'red;position:fixed' })).toBe(html);
  });
  it('applies background only to the section and preserves padding, width and photo', () => {
    const html = '<section style="padding:40px;max-width:800px;background-image:url(/photo.jpg);background-color:red"><p style="color:blue">Text</p></section>';
    const updated = applyBlockBackground(html, { background: 'rgba(23, 23, 23, 0.85)' });
    const root = sectionOf(updated);
    expect(root.attribs['style']).toContain('background-color:rgba(23, 23, 23, 0.85)');
    for (const value of ['padding:40px', 'max-width:800px', 'background-image:url(/photo.jpg)']) expect(root.attribs['style']).toContain(value);
    expect((root.children.find(n => n.type === 'tag') as Element).attribs['style']).toBe('color:blue');
  });
  it('restores existing section text color when contrast is switched off', () => {
    const changed = applyBlockBackground('<section style="color:#123456;padding:20px"></section>', { background: '#ffffff', color: '#1f2937' });
    const restored = sectionOf(applyBlockBackground(changed, { background: 'transparent' }));
    expect(restored.attribs['style']).toContain('color:#123456');
    expect(restored.attribs['data-cms-block-contrast']).toBeUndefined();
  });
  it('chooses dark text on white and white text on black', () => {
    expect(contrastColor('#ffffff')).toBe('#1f2937');
    expect(contrastColor('#000000')).toBe('#ffffff');
  });
  it('serializes original and copied blocks without changing their identities', () => {
    const page = '<div class="page"><section><h2>Original</h2></section></div>';
    const layout: Layout = [{ o: 0 }, { i: 'copy', html: '<section><h2>Copy</h2></section>' }];
    for (const index of [0, 1]) {
      const next = updateBlockBackground(layout, index, { background: '#ffffff', color: '#1f2937' });
      expect(next[index]).toMatchObject(layout[index] ?? {});
      expect(sectionOf(blockHtml(page, next[index] ?? { o: 0 }, {})).attribs['style']).toContain('background-color:#ffffff');
    }
  });
  it('captures scoped computed backgrounds during indexing', () => {
    const rows = indexSite({ '/nl': { html: '<div class="page"><section class="scoped"><h2>Text</h2></section></div>' } }, () => ({ background: 'rgba(23, 23, 23, 0.85)', color: 'rgb(255, 255, 255)' }));
    expect(sectionOf(rows[0]?.html ?? '').attribs['style']).toContain('background-color:rgba(23, 23, 23, 0.85)');
  });
  it('gives every standard contact form a white background and dark text', () => {
    const contacts = STARTER_BLOCKS.filter(b => b.category === 'formulieren');
    expect(contacts).toHaveLength(3);
    for (const block of contacts) {
      expect(sectionOf(block.html).attribs['style']).toContain('background-color:#ffffff');
      expect(sectionOf(block.html).attribs['style']).toContain('color:#1f2937');
    }
  });
});