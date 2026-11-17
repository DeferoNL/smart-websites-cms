export type CmsTheme = 'dark' | 'light';
export const CMS_THEME_KEY = 'sw-cms-theme';
export function cmsTheme(value: string | null): CmsTheme {
  return value === 'light' ? 'light' : 'dark';
}