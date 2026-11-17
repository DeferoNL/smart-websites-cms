import { supabase } from '@/integrations/supabase/client';

/** Classify a referrer hostname into a readable source name. */
export function sourceFrom(referrer: string, ownHost: string): string {
  if (!referrer) return 'Direct / None';
  let host = '';
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch { return 'Direct / None'; }
  if (!host || host === ownHost.replace(/^www\./, '')) return 'Direct / None';
  const known: [RegExp, string][] = [
    [/google\./, 'Google'], [/bing\./, 'Bing'], [/duckduckgo\./, 'DuckDuckGo'], [/yahoo\./, 'Yahoo'],
    [/(facebook|fb)\./, 'Facebook'], [/instagram\./, 'Instagram'], [/linkedin\.|lnkd\.in/, 'LinkedIn'],
    [/youtube\.|youtu\.be/, 'Youtube'], [/(twitter|x)\.com|t\.co$/, 'X / Twitter'], [/chatgpt\.com|openai\./, 'chatgpt.com'],
  ];
  return known.find(([r]) => r.test(host))?.[1] ?? host;
}

export function deviceFrom(ua: string, width: number): string {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'Mobile';
  return width < 1600 ? 'Laptop' : 'Desktop';
}

function id(store: Storage, key: string) {
  let v = store.getItem(key);
  if (!v) { v = crypto.randomUUID(); store.setItem(key, v); }
  return v;
}

let last = '';
export function trackView(path: string) {
  if (typeof window === 'undefined' || path === last) return;
  if (/^\/(smart-websites|reset-password|invite)/.test(path)) return;
  if (document.documentElement.dataset['cmsEditing'] || navigator.webdriver) return;
  const first = !last;
  last = path;
  try {
    void supabase.rpc('track_view', {
      _visitor: id(localStorage, 'sw_vid'),
      _session: id(sessionStorage, 'sw_sid'),
      _path: path.slice(0, 300),
      _source: first ? sourceFrom(document.referrer, location.hostname) : 'Direct / None',
      _device: deviceFrom(navigator.userAgent, window.innerWidth),
    });
  } catch { /* tracking never breaks the site */ }
}
