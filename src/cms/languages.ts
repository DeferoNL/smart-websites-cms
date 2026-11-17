export type SiteLanguages = { default_lang: string; languages: string[] };
export const DEFAULT_SITE_LANGUAGES: SiteLanguages = { default_lang: 'nl', languages: ['nl'] };

export function activeLanguages(settings: SiteLanguages): string[] {
  return Array.from(new Set([settings.default_lang, ...settings.languages]));
}

export function languageEnabled(path: string, settings: SiteLanguages): boolean {
  return activeLanguages(settings).includes(siteLanguage(path));
}

export function shouldCreatePair(language: string, settings: SiteLanguages): boolean {
  return activeLanguages(settings).includes(language);
}

export function siteLanguage(path: string): 'nl' | 'en' {
  return /^\/en(?:\/|$)/.test(path) ? 'en' : 'nl';
}

/** Keep stored CMS keys stable; only the public Dutch address loses its prefix. */
export function publicPath(path: string): string {
  return path.replace(/^\/nl(?=\/|[?#]|$)/, '') || '/';
}

export function cmsPath(path: string): string {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (/^\/(nl|en)(\/|$)/.test(normalized)) return normalized;
  return normalized === '/' ? '/nl' : `/nl${normalized}`;
}

export function availableLanguages(settings: SiteLanguages, paths: string[]): string[] {
  return activeLanguages(settings).filter(language => paths.some(path => siteLanguage(path) === language));
}