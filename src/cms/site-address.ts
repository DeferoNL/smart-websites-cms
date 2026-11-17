/** Keep the configured host exactly as entered; never invent a www subdomain. */
export function siteUrlOf(value: string): string {
  if (!value.trim()) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return url.origin;
  } catch { return ''; }
}

export const normDomain = (value: string) => {
  const url = siteUrlOf(value);
  return url ? new URL(url).host : '';
};