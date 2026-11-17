import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assertReservedAdminUnchanged, reservedAdminEmail } from '../cms/setup-policy.ts';

type Role = 'admin' | 'editor';

/** User administration is reserved to Administrator, never delegated through profile permissions. */
async function assertUserManager(context: { supabase: any; userId: string }) {
  const { data: admin, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || !admin) throw new Error('Alleen Administrator kan gebruikers en rollen beheren.');
}

async function validateProfile(context: { supabase: any }, role: Role, id: string | null) {
  if (role === 'admin') return;
  if (!id) throw new Error('Kies een rol voor deze gebruiker.');
  const { data, error } = await context.supabase.from('cms_roles').select('id').eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Deze rol bestaat niet meer. Kies een andere rol.');
}

export const listUsers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertUserManager(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from('user_roles').select('user_id, role, cms_role_id');
    return data.users.map(u => ({
      id: u.id,
      email: u.email ?? '',
      role: (roles?.find(r => r.user_id === u.id)?.role ?? null) as Role | null,
      cmsRoleId: roles?.find(r => r.user_id === u.id)?.cms_role_id ?? null,
      confirmed: Boolean(u.last_sign_in_at),
      mfa: (u.factors ?? []).some(f => f.status === 'verified'),
      self: u.id === context.userId,
    }));
  });

export const inviteUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: Role; origin: string; cmsRoleId?: string | null }) => {
    const email = String(d.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ongeldig e-mailadres.');
    if (d.role !== 'admin' && d.role !== 'editor') throw new Error('Ongeldige rol.');
    if (!/^https?:\/\/[^/]+$/.test(d.origin)) throw new Error('Ongeldig adres.');
    return { email, role: d.role, origin: d.origin, cmsRoleId: d.role === 'editor' ? d.cmsRoleId ?? null : null };
  })
  .handler(async ({ data, context }) => {
    await assertUserManager(context);
    await validateProfile(context, data.role, data.cmsRoleId);
    if (reservedAdminEmail(data.email) && data.role !== 'admin') throw new Error('De vaste beheerder blijft Administrator.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: res, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${data.origin}/reset-password` });
    if (error) throw new Error(error.message);
    const { error: deleteError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', res.user.id);
    if (deleteError) throw new Error(deleteError.message);
    const { error: rErr } = await supabaseAdmin.from('user_roles').insert({ user_id: res.user.id, role: data.role, cms_role_id: data.cmsRoleId });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: Role; cmsRoleId?: string | null }) => {
    if (d.role !== 'admin' && d.role !== 'editor') throw new Error('Ongeldige rol.');
    return { userId: d.userId, role: d.role, cmsRoleId: d.role === 'editor' ? d.cmsRoleId ?? null : null };
  })
  .handler(async ({ data, context }) => {
    await assertUserManager(context);
    if (data.userId === context.userId) throw new Error('Je kunt je eigen rol niet wijzigen.');
    await validateProfile(context, data.role, data.cmsRoleId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: target, error: targetError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (targetError || !target.user?.email) throw new Error('Gebruiker kon niet veilig worden gecontroleerd.');
    assertReservedAdminUnchanged(target.user.email);
    const { error: deleteError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', data.userId);
    if (deleteError) throw new Error(deleteError.message);
    const { error } = await supabaseAdmin.from('user_roles').insert({ user_id: data.userId, role: data.role, cms_role_id: data.cmsRoleId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertUserManager(context);
    if (data.userId === context.userId) throw new Error('Je kunt jezelf niet verwijderen.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: target, error: targetError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (targetError || !target.user?.email) throw new Error('Gebruiker kon niet veilig worden gecontroleerd.');
    assertReservedAdminUnchanged(target.user.email);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
