import { describe, expect, it } from 'vitest';
import { ensureContainer, announcementHtml } from './blocks';

describe('ensureContainer', () => {
  it('wraps content of a section without container', () => {
    const out = ensureContainer('<section class="x" style="color:red"><h2>Hi</h2></section>');
    expect(out).toBe('<section class="x" style="color:red"><div class="container"><div class="row"><div class="col"><div class="box"><h2>Hi</h2></div></div></div></div></section>');
  });
  it('leaves blocks that already use the site container untouched', () => {
    const html = '<section class="v-54"><div class="container"><div class="row"></div></div></section>';
    expect(ensureContainer(html)).toBe(html);
  });
  it('keeps the announcement inside the container', () => {
    expect(ensureContainer(announcementHtml('#c62828'))).toBe(announcementHtml('#c62828'));
  });
});
