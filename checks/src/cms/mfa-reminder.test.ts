import { describe, expect, it } from 'vitest';
import { mfaReminderDue } from './mfa-reminder';

const now = new Date('2026-11-21T12:00:00Z');

describe('2FA-herinnering om de 2 weken', () => {
  it('stuurt de eerste herinnering direct', () => expect(mfaReminderDue(null, now)).toBe(true));
  it('stuurt niet opnieuw na 13 dagen', () => expect(mfaReminderDue('2026-11-08T12:00:00Z', now)).toBe(false));
  it('stuurt niet na 3 dagen (geen 2x per week)', () => expect(mfaReminderDue('2026-11-18T12:00:00Z', now)).toBe(false));
  it('stuurt opnieuw na 14 dagen', () => expect(mfaReminderDue('2026-11-07T12:00:00Z', now)).toBe(true));
});
