import { describe, expect, it } from 'vitest';
import { coloredIconUrl, isIconColor } from './icon-colors';

const svg = '<svg fill="none" stroke="currentColor"><path fill="currentColor" d="M1 2"/></svg>';
const decode = (url: string) => decodeURIComponent(url.split(',')[1] ?? '');

describe('icon color insertion', () => {
  it('inserts the selected color in every configurable SVG paint', () => {
    expect(decode(coloredIconUrl(svg, '#2563eb'))).toBe('<svg fill="none" stroke="#2563eb"><path fill="#2563eb" d="M1 2"/></svg>');
  });
  it('accepts a custom six-digit hexadecimal color', () => {
    expect(isIconColor('#12AbEF')).toBe(true);
    expect(decode(coloredIconUrl(svg, '#12AbEF'))).toContain('stroke="#12AbEF"');
  });
  it('rejects incomplete or injected paint values and keeps the default', () => {
    expect(isIconColor('#12')).toBe(false);
    expect(isIconColor('red" onload="alert(1)')).toBe(false);
    expect(decode(coloredIconUrl(svg, 'red" onload="alert(1)'))).toContain('stroke="#1f2937"');
  });
});