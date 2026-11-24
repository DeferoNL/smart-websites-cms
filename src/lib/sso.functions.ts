import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CMS_CONFIG } from '../cms/config.ts';
import { deferoSuperadmin } from '../cms/setup-policy.ts';
import { recentStrongSignIn, signTicket, verifyTicket, SSO_TICKET_TTL_S } from '../cms/sso.ts';
import { normDomain } from '../cms/site-address.ts';

async function requestHost() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return new URL(getRequest().url).host.toLowerCase();
}
async function assertMaster() {
  if (!(CMS_CONFIG.masterHosts as readonly string[]).includes(await requestHost())) throw new Error('Alleen beschikbaar in de Master.');
}
async function emailOf(context: { supabase: any }) {
  const { data } = await context.supabase.auth.getUser();
  return String(data?.user?.email ?? '').toLowerCase();
}

/** Master: a Defero superadmin who signed in with Google receives the Administrator role there. */
export const claimMasterSuperadmin = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster();
    const email = await emailOf(context);
    if (!deferoSuperadmin(email)) return { admin: false, granted: false };
    if (!recentStrongSignIn(context.claims as any, Date.now())) return { admin: false, granted: false };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: has } = await supabaseAdmin.from('user_roles').select('id').eq('user_id', context.userId).eq('role', 'admin').maybeSingle();
    if (!has) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', context.userId);
      const { error } = await supabaseAdmin.from('user_roles').insert({ user_id: context.userId, role: 'admin', cms_role_id: null });
      if (error) throw new Error(error.message);
      return { admin: true, granted: true };
    }
    return { admin: true, granted: false };
  });

/** Master: issues a 60-second ticket for one registered client site. */
export const issueSiteTicket = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { host: string }) => ({ host: normDomain(String(d.host)) }))
  .handler(async ({ data, context }) => {
    await assertMaster();
    const email = await emailOf(context);
    if (!deferoSuperadmin(email)) throw new Error('Alleen Defero-beheerders kunnen centraal inloggen.');
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!admin) throw new Error('Alleen Administrator kan centraal inloggen.');
    if (!recentStrongSignIn(context.claims as any, Date.now())) throw new Error('Log opnieuw in met Google of tweestapsverificatie om door te gaan.');
    const { data: site } = await context.supabase.from('cms_client_sites').select('host').eq('host', data.host).maybeSingle();
    if (!site) throw new Error('Deze website is niet bij de Master aangemeld.');
    const raw = process.env['CMS_SSO_SIGNING_KEY'];
    if (!raw) throw new Error('Centrale inlog is nog niet ingericht.');
    const now = Math.floor(Date.now() / 1000);
    const ticket = await signTicket(JSON.parse(raw), { iss: new URL(CMS_CONFIG.masterUrl).host, aud: data.host, sub: email, iat: now, exp: now + SSO_TICKET_TTL_S, jti: crypto.randomUUID() });
    return { url: `https://${data.host}/smart-websites?sso=${encodeURIComponent(ticket)}` };
  });

/** Client site: verifies a master ticket, ensures the superadmin is local Administrator and returns a one-time sign-in token. */
export const redeemSiteTicket = createServerFn({ method: 'POST' })
  .inputValidator((d: { ticket: string }) => ({ ticket: String(d.ticket).slice(0, 2000) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: s } = await supabaseAdmin.from('site_settings').select('site_domain').eq('id', 1).maybeSingle();
    const t = await verifyTicket(CMS_CONFIG.ssoPublicKey, data.ticket, { hosts: [normDomain(s?.site_domain ?? ''), await requestHost()], now: Date.now(), allowed: deferoSuperadmin });
    if (!t) throw new Error('Deze inloglink is niet geldig of verlopen. Probeer het opnieuw vanuit de Master.');
    const email = t.sub.toLowerCase();
    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error('Inloggen mislukt.');
      userId = list.users.find(u => u.email?.toLowerCase() === email)?.id ?? null;
      if (list.users.length < 200) break;
    }
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
      if (error || !created.user) throw new Error('Beheerder kon niet worden aangemaakt.');
      userId = created.user.id;
    }
    const { data: has } = await supabaseAdmin.from('user_roles').select('id').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (!has) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'admin', cms_role_id: null });
      if (error) throw new Error('Beheerdersrol kon niet worden toegekend.');
    }
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !link.properties?.hashed_token) throw new Error('Inloggen mislukt.');
    return { tokenHash: link.properties.hashed_token };
  });
