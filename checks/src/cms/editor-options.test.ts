import { describe, expect, it } from 'vitest';
import { toggleBlock } from './blocks';
import { imageShapeStyle, withBackground } from './content';

describe('block on/off', () => {
  it('switches only the chosen block off and back on', () => {
    const off = toggleBlock([{ o: 0 }, { o: 1 }], 1);
    expect(off[1]?.off).toBe(true);
    expect(off[0]?.off).toBeUndefined();
    expect(toggleBlock(off, 1)[1]?.off).toBe(false);
  });
});

describe('photo shape', () => {
  it('round is square with a 50% radius', () => {
    expect(imageShapeStyle({ shape: 'round' })).toMatchObject({ aspectRatio: '1 / 1', borderRadius: '50%' });
  });
  it('portrait is 3:4 and rounded corners add a radius', () => {
    expect(imageShapeStyle({ shape: 'portrait', rounded: true })).toMatchObject({ aspectRatio: '3 / 4', borderRadius: '16px' });
  });
});

describe('background photo', () => {
  it('replaces the background photo and alignment', () => {
    const s = withBackground('background-image:url(https://a.nl/x.jpg)', { bg: '/cms-media/y.jpg', position: 'left top' });
    expect(s).toContain('url(/cms-media/y.jpg)');
    expect(s).toContain('background-position:left top');
  });
});
