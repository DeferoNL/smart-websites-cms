import { describe, expect, it } from 'vitest';
import { activeLanguages, availableLanguages, cmsPath, publicPath, DEFAULT_SITE_LANGUAGES, languageEnabled, shouldCreatePair } from './languages';

describe('optional website languages', () => {
  it('starts with Dutch only', () => {
    expect(activeLanguages(DEFAULT_SITE_LANGUAGES)).toEqual(['nl']);
  });
  it('does not expose English when disabled', () => {
    expect(languageEnabled('/en/services', DEFAULT_SITE_LANGUAGES)).toBe(false);
    expect(languageEnabled('/nl/diensten', DEFAULT_SITE_LANGUAGES)).toBe(true);
  });
  it('does not create an English counterpart on a Dutch-only site', () => {
    expect(shouldCreatePair('en', DEFAULT_SITE_LANGUAGES)).toBe(false);
  });
  it('allows English pages and counterparts when explicitly enabled', () => {
    const bilingual = { default_lang: 'nl', languages: ['nl', 'en'] };
    expect(languageEnabled('/en/services', bilingual)).toBe(true);
    expect(shouldCreatePair('en', bilingual)).toBe(true);
  });
  it('uses clean Dutch public URLs', () => {
    expect(publicPath('/nl')).toBe('/');
    expect(publicPath('/nl/diensten')).toBe('/diensten');
    expect(publicPath('/nl/contact')).toBe('/contact');
  });
  it('keeps English public URLs prefixed', () => {
    expect(publicPath('/en/services')).toBe('/en/services');
  });
  it('resolves clean Dutch addresses to existing CMS content', () => {
    expect(cmsPath('/diensten/')).toBe('/nl/diensten');
    expect(cmsPath('/')).toBe('/nl');
    expect(cmsPath('/en/services')).toBe('/en/services');
  });
  it('offers only Dutch when English is not enabled, even with English templates', () => {
    expect(availableLanguages(DEFAULT_SITE_LANGUAGES, ['/nl', '/en'])).toEqual(['nl']);
  });
  it('does not offer English without English pages', () => {
    expect(availableLanguages({ default_lang: 'nl', languages: ['nl', 'en'] }, ['/nl/diensten'])).toEqual(['nl']);
  });
  it('offers the switch when English is enabled and has pages', () => {
    expect(availableLanguages({ default_lang: 'nl', languages: ['nl', 'en'] }, ['/nl', '/en/services'])).toEqual(['nl', 'en']);
  });
});