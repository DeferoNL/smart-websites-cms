import { describe, expect, it } from 'vitest';
import { recentStrongSignIn, signTicket, verifyTicket } from './sso';
import { deferoSuperadmin, assertReservedAdminUnchanged } from './setup-policy';

async function keys() {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  return { priv: await crypto.subtle.exportKey('jwk', k.privateKey), pub: await crypto.subtle.exportKey('jwk', k.publicKey) };
}
const NOW = 1_800_000_000_000;
const base = { iss: 'master', aud: 'klant.nl', sub: 'kars@defero.nl', iat: NOW / 1000, exp: NOW / 1000 + 60, jti: 'x' };
const opts = { hosts: ['klant.nl'], now: NOW, allowed: deferoSuperadmin };

describe('central sign-in tickets', () => {
  it('accepts a valid ticket for this site', async () => {
    const { priv, pub } = await keys();
    expect(await verifyTicket(pub, await signTicket(priv, base), opts)).not.toBeNull();
  });
  it('rejects a ticket for another website', async () => {
    const { priv, pub } = await keys();
    expect(await verifyTicket(pub, await signTicket(priv, { ...base, aud: 'ander.nl' }), opts)).toBeNull();
  });
  it('rejects an expired ticket (older than 60 seconds)', async () => {
    const { priv, pub } = await keys();
    expect(await verifyTicket(pub, await signTicket(priv, base), { ...opts, now: NOW + 61_000 })).toBeNull();
  });
  it('rejects tickets signed with another key or for non-Defero accounts', async () => {
    const a = await keys(); const b = await keys();
    expect(await verifyTicket(b.pub, await signTicket(a.priv, base), opts)).toBeNull();
    expect(await verifyTicket(a.pub, await signTicket(a.priv, { ...base, sub: 'klant@example.nl' }), opts)).toBeNull();
  });
  it('rejects tickets with a lifetime longer than 60 seconds', async () => {
    const { priv, pub } = await keys();
    expect(await verifyTicket(pub, await signTicket(priv, { ...base, exp: base.iat + 3600 }), opts)).toBeNull();
  });
  it('requires a recent Google or two-factor sign-in', () => {
    const s = NOW / 1000;
    expect(recentStrongSignIn({ amr: [{ method: 'oauth', timestamp: s - 60 }] }, NOW)).toBe(true);
    expect(recentStrongSignIn({ amr: [{ method: 'password', timestamp: s - 60 }], aal: 'aal1' }, NOW)).toBe(false);
    expect(recentStrongSignIn({ amr: [{ method: 'oauth', timestamp: s - 13 * 3600 }] }, NOW)).toBe(false);
  });
  it('protects both Defero administrators', () => {
    expect(() => assertReservedAdminUnchanged('kars@defero.nl')).toThrow();
    expect(() => assertReservedAdminUnchanged('office@defero.nl')).toThrow();
  });
});
