import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { initializePasswordSession, INVALID_PASSWORD_LINK } from './password-session';

function fixture() {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'invited-user' } }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
  };
  return { auth, run: (url: string, current?: () => string) => initializePasswordSession(auth as unknown as SupabaseClient['auth'], url, current) };
}

describe('invitation and recovery session initialization', () => {
  it.each(['invite', 'recovery'])('verifies a %s token before permitting password updates', async type => {
    const { auth, run } = fixture();
    await run(`https://client.example/reset-password?token_hash=test-hash&type=${type}`);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-hash', type });
    expect(auth.getUser).toHaveBeenCalledTimes(2);
  });
  it('exchanges a PKCE callback and revalidates the resulting user', async () => {
    const { auth, run } = fixture();
    await run('https://client.example/reset-password?code=test-code');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(auth.getUser).toHaveBeenCalledTimes(2);
  });
  it('does not consume an automatically exchanged PKCE code twice', async () => {
    const { auth, run } = fixture();
    await run('https://client.example/reset-password?code=test-code', () => 'https://client.example/reset-password');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it.each(['invite', 'recovery'])('restores a %s hash session using both tokens', async type => {
    const { auth, run } = fixture();
    await run(`https://client.example/reset-password#type=${type}&access_token=test-access&refresh_token=test-refresh`);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
  });
  it('waits for authentication initialization instead of immediately showing the form', async () => {
    const { auth, run } = fixture();
    let finish: (() => void) | undefined;
    auth.getUser.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ data: { user: { id: 'invited-user' } }, error: null }); }));
    let ready = false;
    const pending = run('https://client.example/reset-password').then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    if (!finish) throw new Error('Initialization was not started');
    finish();
    await pending;
    expect(ready).toBe(true);
  });
  it('rejects a missing or expired session', async () => {
    const { auth, run } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Auth session missing') });
    await expect(run('https://client.example/reset-password')).rejects.toThrow(INVALID_PASSWORD_LINK);
  });
  it('rejects an already-used invitation even if another account is signed in', async () => {
    const { auth, run } = fixture();
    auth.verifyOtp.mockResolvedValue({ error: new Error('Token expired') });
    await expect(run('https://client.example/reset-password?token_hash=used&type=invite')).rejects.toThrow(INVALID_PASSWORD_LINK);
  });
  it.each([
    '?error_code=otp_expired', '#error=access_denied&type=recovery',
    '?token_hash=test&type=signup', '#type=recovery&access_token=incomplete',
  ])('rejects invalid callback %s', async callback => {
    const { run } = fixture();
    await expect(run(`https://client.example/reset-password${callback}`)).rejects.toThrow(INVALID_PASSWORD_LINK);
  });
});