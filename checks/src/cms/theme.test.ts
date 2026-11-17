import { describe, expect, it } from 'vitest';
import { cmsTheme } from './theme';

describe('CMS theme preference', () => {
  it('defaults to nightmode without a saved choice', () => { expect(cmsTheme(null)).toBe('dark'); });
  it('restores daylight mode when chosen', () => { expect(cmsTheme('light')).toBe('light'); });
});