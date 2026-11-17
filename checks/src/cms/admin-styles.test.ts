import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles.css', 'utf8');
const button = readFileSync('src/components/ui/button.tsx', 'utf8');

describe('CMS icon buttons', () => {
  it('icon size carries the size-icon class and no padding', () => {
    expect(button).toMatch(/icon:\s*"[^"]*\bsize-icon\b[^"]*\bp-0\b/);
  });
  it('icon-only buttons are forced to zero side padding', () => {
    expect(css).toMatch(/\.sw-admin button\.size-icon[^{]*\{[^}]*padding-left:\s*0 !important/);
  });
  it('icons inside buttons never shrink', () => {
    expect(css).toMatch(/\.sw-admin button > svg[^{]*\{[^}]*flex-shrink:\s*0/);
  });
});
