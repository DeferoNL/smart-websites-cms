import { createServerFn } from '@tanstack/react-start';
import { CMS_CONFIG } from '../cms/config.ts';
import { CMS_VERSION, type ChangelogEntry } from '../cms/version.ts';
import { normDomain } from '../cms/site-address.ts';

// Fetches the master's latest version server-side (8s timeout) and reports this site's host,
// installed version and numeric stats (POST, per-site token). Falls back to a plain GET.
export const getMasterVersion = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const endpoint = `${CMS_CONFIG.masterUrl}/api/public/cms-version`;
    let res: Response | null = null;
    try {
      const { getRequest } = await import('@tanstack/react-start/server');
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: s } = await supabaseAdmin.from('site_settings').select('site_domain, project_name').eq('id', 1).maybeSingle();
      const host = normDomain(s?.site_domain ?? '') || new URL(getRequest().url).host;
      if (host && new URL(CMS_CONFIG.masterUrl).host !== host) {
        let { data: t } = await supabaseAdmin.from('cms_site_token').select('token').eq('id', 1).maybeSingle();
        if (!t) {
          const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
          await supabaseAdmin.from('cms_site_token').insert({ id: 1, token });
          ({ data: t } = await supabaseAdmin.from('cms_site_token').select('token').eq('id', 1).maybeSingle());
        }
        const { data: stats } = await supabaseAdmin.rpc('cms_site_stats');
        if (t && stats) {
          res = await fetch(endpoint, {
            method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
            body: JSON.stringify({ host, version: CMS_VERSION, name: s?.project_name ? String(s.project_name).slice(0, 120) : undefined, token: t.token, stats }),
          });
          if (!res.ok) res = null;
        }
      }
    } catch { res = null; }
    if (!res) res = await fetch(endpoint, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) return { ok: false as const, error: 'Master niet bereikbaar.' };
    const j = (await res.json()) as { version?: unknown; changelog?: unknown };
    if (typeof j.version !== 'string' || !Array.isArray(j.changelog)) return { ok: false as const, error: 'Onverwacht antwoord van de master.' };
    return { ok: true as const, version: j.version, changelog: (j.changelog as ChangelogEntry[]).slice(0, 20) };
  } catch {
    return { ok: false as const, error: 'Master niet bereikbaar.' };
  }
});
