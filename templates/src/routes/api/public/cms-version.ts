import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CMS_VERSION, CHANGELOG } from '@defero/smart-websites-cms/src/cms/version.ts';
import { reportSchema, hashToken, tokenAccepted } from '@defero/smart-websites-cms/src/cms/site-report.ts';

// Public: returns only version + changelog. Client sites may add host/version/name so the master
// knows which projects lag behind; those values are validated and only stored, never returned.
const base = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
const report = z.object({
  host: z.string().trim().toLowerCase().min(3).max(253).regex(/^[a-z0-9.-]+(:\d{1,5})?$/),
  version: z.string().trim().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/),
  name: z.string().trim().max(120).optional(),
});

export const Route = createFileRoute('/api/public/cms-version')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const parsed = report.safeParse({ host: q.get('host') ?? '', version: q.get('version') ?? '', name: q.get('name') || undefined });
        if (parsed.success) {
          try {
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
            await supabaseAdmin.from('cms_client_sites').upsert(
              { host: parsed.data.host, version: parsed.data.version, site_name: parsed.data.name ?? null, last_seen: new Date().toISOString() },
              { onConflict: 'host' },
            );
          } catch { /* reporting is best-effort */ }
        }
        const cache = parsed.success ? 'no-store' : 'public, max-age=60';
        return Response.json({ version: CMS_VERSION, changelog: CHANGELOG }, { headers: { ...base, 'Cache-Control': cache } });
      },
      // 3.0.0+: report with numeric stats, authenticated by a per-site token (hash stored on first report).
      POST: async ({ request }) => {
        const headers = { ...base, 'Cache-Control': 'no-store' };
        let body: unknown;
        try { body = await request.json(); } catch { return new Response('Bad request', { status: 400, headers }); }
        const p = reportSchema.safeParse(body);
        if (!p.success) return new Response('Bad request', { status: 400, headers });
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const hash = await hashToken(p.data.token);
          const { data: row } = await supabaseAdmin.from('cms_client_sites').select('token_hash').eq('host', p.data.host).maybeSingle();
          if (!tokenAccepted(row?.token_hash, hash)) return new Response('Forbidden', { status: 403, headers });
          await supabaseAdmin.from('cms_client_sites').upsert(
            { host: p.data.host, version: p.data.version, site_name: p.data.name ?? null, stats: p.data.stats, token_hash: hash, last_seen: new Date().toISOString() },
            { onConflict: 'host' },
          );
        } catch { /* best-effort */ }
        return Response.json({ version: CMS_VERSION, changelog: CHANGELOG }, { headers });
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: base }),
    },
  },
});
