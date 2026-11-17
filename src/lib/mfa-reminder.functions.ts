import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { mfaReminderDue } from '../cms/mfa-reminder.ts';

/**
 * Called when a signed-in CMS user opens the dashboard. If that user has no
 * verified 2FA and the last reminder is 14+ days old, sends one reminder email
 * to that user only. Returns whether 2FA is missing (for the in-app banner).
 */
export const checkMfaReminder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => {
    if (!/^https?:\/\/[^/]+$/.test(d.origin)) throw new Error('Ongeldig adres.');
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: res, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !res.user) return { missing: false };
    const u = res.user;
    const hasMfa = (u.factors ?? []).some(f => f.status === 'verified');
    if (hasMfa || !u.email) return { missing: !hasMfa };
    const last = (u.app_metadata as Record<string, unknown> | undefined)?.['mfa_reminder_at'] as string | undefined;
    if (!mfaReminderDue(last)) return { missing: true };
    const sentAt = new Date().toISOString();
    // Claim the slot first so parallel tabs don't double-send.
    await supabaseAdmin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, mfa_reminder_at: sentAt } });
    try {
      const { sendTemplateEmail } = await import('./email-templates/send-email.ts');
      await sendTemplateEmail('mfa-reminder', u.email, {
        templateData: { dashboardUrl: `${data.origin}/smart-websites` },
        idempotencyKey: `mfa-reminder-${u.id}-${sentAt.slice(0, 10)}`,
      });
    } catch (e) {
      console.error('2FA reminder failed', e);
      await supabaseAdmin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, mfa_reminder_at: last ?? null } });
    }
    return { missing: true };
  });
