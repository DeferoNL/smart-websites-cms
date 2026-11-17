import { describe, expect, it } from 'vitest';
import { compareVersions, latestSecurityVersion, CHANGELOG, CMS_VERSION } from './version';

describe('security releases', () => {
  it('picks the newest release marked as security', () => {
    expect(latestSecurityVersion([
      { version: '2.6.0', date: '', changes: [], security: true },
      { version: '2.9.0', date: '', changes: [] },
      { version: '2.8.0', date: '', changes: [], security: true },
    ])).toBe('2.8.0');
  });
  it('flags a site on 2.7.0 as missing the current security update', () => {
    expect(compareVersions('2.7.0', latestSecurityVersion(CHANGELOG)!)).toBeLessThan(0);
    expect(CHANGELOG[0]?.version).toBe(CMS_VERSION);
  });
});
