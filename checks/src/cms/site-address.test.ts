import { describe, expect, it } from 'vitest';
import { normDomain, siteUrlOf } from './site-address';

describe('client website addresses', () => {
  it('uses the client domain without inventing www', () => expect(siteUrlOf('defero.nl')).toBe('https://defero.nl'));
  it('preserves an explicitly connected subdomain', () => expect(siteUrlOf('preview.klant.nl')).toBe('https://preview.klant.nl'));
  it('preserves explicitly configured www', () => expect(normDomain('https://www.klant.nl/contact')).toBe('www.klant.nl'));
  it('rejects credentials in an address', () => expect(siteUrlOf('https://user:password@klant.nl')).toBe(''));
});