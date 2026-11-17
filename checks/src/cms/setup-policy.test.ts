import { describe, expect, it } from 'vitest';
import { assertReservedAdminUnchanged, reservedAdminEmail, setupAvailable, setupRetryAllowed, SETUP_RETRY_MS } from './setup-policy';

describe('reserved administrator protections', () => {
  it('blocks deleting or changing the role of office@defero.nl', () => {
    expect(() => assertReservedAdminUnchanged(' OFFICE@DEFERO.NL ')).toThrow();
    expect(() => assertReservedAdminUnchanged('other@example.nl')).not.toThrow();
  });
  it('waits exactly ten minutes before another installation request', () => {
    expect(SETUP_RETRY_MS).toBe(600000);
    expect(setupRetryAllowed(1000, 600999)).toBe(false);
    expect(setupRetryAllowed(1000, 601000)).toBe(true);
    expect(setupRetryAllowed(NaN, 601000)).toBe(false);
    expect(setupRetryAllowed(null, 0)).toBe(true);
  });
  it('accepts only the reserved installation address', () => {
    expect(reservedAdminEmail('office@defero.nl')).toBe(true);
    expect(reservedAdminEmail('visitor@example.nl')).toBe(false);
  });
  it('never reopens a completed or already invited installation', () => {
    expect(setupAvailable({ completed: false, invitedUserId: null, hasAdmin: false })).toBe(true);
    expect(setupAvailable({ completed: true, invitedUserId: null, hasAdmin: false })).toBe(false);
    expect(setupAvailable({ completed: false, invitedUserId: 'pending', hasAdmin: false })).toBe(false);
    expect(setupAvailable({ completed: false, invitedUserId: null, hasAdmin: true })).toBe(false);
  });
});