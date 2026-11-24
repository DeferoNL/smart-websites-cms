import type { SupabaseClient } from '@supabase/supabase-js';

export const INVALID_PASSWORD_LINK = 'Deze link is niet meer geldig of is al gebruikt. Vraag een nieuwe link aan via het inlogscherm.';

/** Wait for SDK URL initialization, handle remaining callback credentials, then revalidate with Auth. */
export async function initializePasswordSession(
  auth: SupabaseClient['auth'],
  href: string,
  currentHref: () => string = () => href,
): Promise<void> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has('error') || hash.has('error') || url.searchParams.has('error_code') || hash.has('error_code')) {
    throw new Error(INVALID_PASSWORD_LINK);
  }
  const type = url.searchParams.get('type') ?? hash.get('type');
  if (type && type !== 'invite' && type !== 'recovery') throw new Error(INVALID_PASSWORD_LINK);

  // getUser awaits the SDK's automatic hash/PKCE initialization as well as validating the user.
  const initial = await auth.getUser();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (tokenHash) {
    if (type !== 'invite' && type !== 'recovery') throw new Error(INVALID_PASSWORD_LINK);
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw new Error(INVALID_PASSWORD_LINK);
  } else if (code) {
    // The SDK may already have consumed the code and removed it from the URL.
    if (new URL(currentHref()).searchParams.has('code') || initial.error || !initial.data.user) {
      const { error } = await auth.exchangeCodeForSession(code);
      if (error) throw new Error(INVALID_PASSWORD_LINK);
    }
  } else if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken || (type !== 'invite' && type !== 'recovery')) throw new Error(INVALID_PASSWORD_LINK);
    if (new URL(currentHref()).hash.includes('access_token') || initial.error || !initial.data.user) {
      const { error } = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw new Error(INVALID_PASSWORD_LINK);
    }
  }
  const { data, error } = await auth.getUser();
  if (error || !data.user) throw new Error(INVALID_PASSWORD_LINK);
}