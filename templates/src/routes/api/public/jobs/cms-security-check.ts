import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { CHANGELOG, compareVersions, latestSecurityVersion } from '@defero/smart-websites-cms/src/cms/version.ts';
import { updatePrompt } from '@defero/smart-websites-cms/src/cms/update-prompt.ts';

// Daily: emails office@defero.nl when reporting client sites run below the newest security release.
export const Route = createFileRoute('/api/public/jobs/cms-security-check')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const securityVersion = latestSecurityVersion(CHANGELOG);
        if (!securityVersion) return Response.json({ ok: true, outdated: 0 });
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data, error } = await supabaseAdmin.from('cms_client_sites').select('host, site_name, version, last_seen');
        if (error) return Response.json({ ok: false }, { status: 500 });
        const outdated = (data ?? []).filter(s => compareVersions(s.version, securityVersion) < 0);
        if (!outdated.length) return Response.json({ ok: true, outdated: 0 });
        const { sendTemplateEmail } = await import('@/lib/email-templates/send-email');
        const day = new Date().toISOString().slice(0, 10);
        const result = await sendTemplateEmail('cms-security-alert', 'office@defero.nl', {
          idempotencyKey: `cms-security-alert-${securityVersion}-${day}`,
          templateData: {
            securityVersion,
            prompt: updatePrompt(),
            sites: outdated.map(s => ({ host: s.host, name: s.site_name, version: s.version, lastSeen: new Date(s.last_seen).toLocaleDateString('nl-NL') })),
          },
        });
        return Response.json({ ok: true, outdated: outdated.length, sent: result.sent });
      },
    },
  },
});
