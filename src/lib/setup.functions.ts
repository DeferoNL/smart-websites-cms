import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { publicClient } from './cms.functions.ts';
import { reservedAdminEmail, setupAvailable, setupRetryAllowed } from '../cms/setup-policy.ts';

export const getCmsSetup = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().rpc('cms_setup_available');
  if (error) throw new Error('Installatiestatus kon niet worden gecontroleerd.');
  return Boolean(data);
});

// No caller-supplied email, role or redirect. SQL serializes and throttles this one-time claim.
export const requestCmsSetup = createServerFn({ method: 'POST' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: state, error: stateError } = await supabaseAdmin.from('cms_installation').select('*').eq('id', 1).maybeSingle();
  const { data: available, error: availableError } = await supabaseAdmin.rpc('cms_setup_available');
  const invitedUserId = state && 'invited_user_id' in state && typeof state.invited_user_id === 'string' ? state.invited_user_id : null;
  if (stateError || availableError || !setupAvailable({ completed: Boolean(state?.completed_at), invitedUserId, hasAdmin: available !== true })) throw new Error('Installatie is niet beschikbaar.');
  if (!setupRetryAllowed(state?.requested_at ? Date.parse(state.requested_at) : null, Date.now())) throw new Error('Probeer het over tien minuten opnieuw.');
  const { data: email, error } = await supabaseAdmin.rpc('claim_cms_setup');
  if (error || !email) throw new Error(error?.message ?? 'Installatie is niet beschikbaar.');
  if (!reservedAdminEmail(email)) throw new Error('Ongeldig beheerdersadres.');
  const origin = new URL(getRequest().url).origin;
  const { error: invitationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (invitationError) throw new Error('Uitnodigen is niet gelukt. Controleer de e-mailinstellingen en of het beheerdersaccount al bestaat.');
  return { ok: true };
});