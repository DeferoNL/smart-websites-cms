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

const memoryIds = new Map<string, string>();
function id(storage: 'localStorage' | 'sessionStorage', key: string) {
  const remembered = memoryIds.get(key);
  if (remembered) return remembered;
  let value = crypto.randomUUID() as string;
  try {
    const store = window[storage];
    value = store.getItem(key) || value;
    store.setItem(key, value);
  } catch { /* No fingerprinting: blocked storage uses a page-lifetime random ID. */ }
  memoryIds.set(key, value);
  return value;
}

let last = '';
const pending = new Set<string>();
export async function trackView(path: string): Promise<void> {
  if (typeof window === 'undefined' || path === last) return;
  if (!path.startsWith('/') || /^\/(smart-websites|reset-password|invite|cms-media|api)(?:\/|$)/.test(path)) return;
  const mode = new URLSearchParams(window.location.search).get('cms');
  if (mode === 'edit' || mode === 'preview' || document.documentElement.hasAttribute('data-cms-editing') || navigator.webdriver) return;
  if (pending.has(path)) return;
  const first = !last;
  pending.add(path);
  try {
    // PostgREST builders are lazy thenables: void rpc(...) never sends a request.
    const { error } = await supabase.rpc('track_view', {
      _visitor: id('localStorage', 'sw_vid'),
      _session: id('sessionStorage', 'sw_sid'),
      _path: path.slice(0, 300),
      _source: first ? sourceFrom(document.referrer, location.hostname) : 'Direct / None',
      _device: deviceFrom(navigator.userAgent, window.innerWidth),
    });
    if (!error) last = path;
  } catch { /* tracking never breaks the site; a failed path remains retryable */ }
  finally { pending.delete(path); }
}
