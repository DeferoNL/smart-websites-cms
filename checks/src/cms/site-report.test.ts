import { describe, expect, it } from 'vitest';
import { siteStatus, tokenAccepted, reportSchema, hashToken } from './site-report';

const now = new Date('2026-11-11T12:00:00Z').getTime();
const recent = '2026-11-10T12:00:00Z';
describe('site report', () => {
  it('flags missing security update', () => expect(siteStatus('2.7.0', recent, '3.0.0', '2.8.0', now)).toBe('security'));
  it('flags normal update', () => expect(siteStatus('2.9.0', recent, '3.0.0', '2.8.0', now)).toBe('update'));
  it('is ok on latest', () => expect(siteStatus('3.0.0', recent, '3.0.0', '2.8.0', now)).toBe('ok'));
  it('is silent after 7 days', () => expect(siteStatus('3.0.0', '2026-11-03T11:00:00Z', '3.0.0', null, now)).toBe('silent'));
  it('accepts first token, rejects a different one', () => {
    expect(tokenAccepted(null, 'a')).toBe(true);
    expect(tokenAccepted('a', 'a')).toBe(true);
    expect(tokenAccepted('a', 'b')).toBe(false);
  });
  it('rejects reports with text in stats', () => {
    const r = reportSchema.safeParse({ host: 'x.nl', version: '3.0.0', token: 'x'.repeat(40), stats: { users: 'jan@x.nl' } });
    expect(r.success).toBe(false);
  });
  it('hashes tokens deterministically', async () => expect(await hashToken('abc')).toBe(await hashToken('abc')));
});
