import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { publicClient } from './cms.functions.ts';

export const getCmsSetup = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().rpc('cms_setup_available');
  if (error) throw new Error('Installatiestatus kon niet worden gecontroleerd.');
  return Boolean(data);
});

// No caller-supplied email, role or redirect. SQL serializes and throttles this one-time claim.
export const requestCmsSetup = createServerFn({ method: 'POST' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: email, error } = await supabaseAdmin.rpc('claim_cms_setup');
  if (error || !email) throw new Error(error?.message ?? 'Installatie is niet beschikbaar.');
  const origin = new URL(getRequest().url).origin;
  const { error: invitationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (invitationError) throw new Error('Uitnodigen is niet gelukt. Controleer de e-mailinstellingen en of het beheerdersaccount al bestaat.');
  return { ok: true };
});