import { describe, expect, it } from 'vitest';
import { categorize, extractBlocks, fingerprint, indexSite } from './block-index';

const page = (inner: string) => `<div class="page"><header><nav>m</nav></header>${inner}<footer>f</footer></div>`;

describe('block index', () => {
  it('skips header, nav and footer', () => {
    expect(extractBlocks(page('<section class="block-text"><h2>A</h2></section>'))).toHaveLength(1);
  });
  it('dedupes blocks with same structure but other text', () => {
    const a = '<section class="block-text"><h2>A</h2></section>';
    const b = '<section class="block-text"><h2>Heel anders</h2></section>';
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(indexSite({ '/nl': { html: page(a) }, '/nl/x': { html: page(b) } })).toHaveLength(1);
  });
  it('categorizes', () => {
    expect(categorize('<section class="block-hero"><h1>x</h1></section>')).toBe('hero');
    expect(categorize('<section><form></form></section>')).toBe('formulieren');
    expect(categorize('<section class="block-cards"><div class="card"></div><div class="card"></div></section>', '/nl/diensten')).toBe('diensten');
    expect(categorize('<section class="block-cards"><div class="card"></div><div class="card"></div></section>', '/nl')).toBe('collecties');
    expect(categorize('<section class="block-cta"><h2>x</h2></section>')).toBe('cta');
  });
});
