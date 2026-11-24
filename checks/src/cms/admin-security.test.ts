import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), state: vi.fn(), target: vi.fn(), invite: vi.fn(), remove: vi.fn(), from: vi.fn(),
}));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => new Request('https://client.example.nl/smart-websites') }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  rpc: mocks.rpc, from: mocks.from,
  auth: { admin: { getUserById: mocks.target, inviteUserByEmail: mocks.invite, deleteUser: mocks.remove } },
} }));
vi.mock('../lib/cms.functions', () => ({ publicClient: () => ({ rpc: mocks.rpc }) }));
import { requestCmsSetup } from '../lib/setup.functions';
import { inviteUser, removeUser, setUserRole } from '../lib/users.functions';

// Test actual handler bodies while replacing only the framework and remote services.
type Handler = (args: { data?: unknown; context?: unknown }) => Promise<unknown>;
const run = (fn: unknown, args: Parameters<Handler>[0] = {}) => (fn as Handler)(args);
const context = { userId: 'acting-admin', supabase: { rpc: vi.fn().mockResolvedValue({ data: true, error: null }), from: mocks.from } };

describe('administrator server guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.state }) }) }));
    mocks.state.mockResolvedValue({ data: { completed_at: null, requested_at: null }, error: null });
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'cms_setup_available' ? true : 'office@defero.nl', error: null }));
    mocks.target.mockResolvedValue({ data: { user: { email: 'office@defero.nl' } }, error: null });
    mocks.invite.mockResolvedValue({ error: null });
  });
  it('rejects removing the fixed administrator before deleting an account', async () => {
    await expect(run(removeUser, { data: { userId: 'reserved' }, context })).rejects.toThrow(/vaste beheerder/);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rejects changing the fixed administrator before changing any role rows', async () => {
    await expect(run(setUserRole, { data: { userId: 'reserved', role: 'admin', cmsRoleId: null }, context })).rejects.toThrow(/vaste beheerder/);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects an unsafe installation email returned by the claim', async () => {
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'cms_setup_available' ? true : 'outsider@example.nl', error: null }));
    await expect(run(requestCmsSetup)).rejects.toThrow(/beheerdersadres/);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('blocks retries during the ten-minute interval before claiming or sending', async () => {
    mocks.state.mockResolvedValue({ data: { completed_at: null, requested_at: new Date(Date.now() - 599000).toISOString() }, error: null });
    await expect(run(requestCmsSetup)).rejects.toThrow(/tien minuten/);
    expect(mocks.rpc).not.toHaveBeenCalledWith('claim_cms_setup');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('preserves the client pending-invitation latch', async () => {
    mocks.state.mockResolvedValue({ data: { completed_at: null, requested_at: null, invited_user_id: 'pending' }, error: null });
    await expect(run(requestCmsSetup)).rejects.toThrow(/niet beschikbaar/);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('sends a permitted installation only to office@defero.nl at the current website', async () => {
    await expect(run(requestCmsSetup)).resolves.toEqual({ ok: true });
    expect(mocks.invite).toHaveBeenCalledWith('office@defero.nl', { redirectTo: 'https://client.example.nl/reset-password' });
  });
  it('never continues destructive operations if account lookup fails', async () => {
    mocks.target.mockResolvedValue({ data: { user: null }, error: new Error('unavailable') });
    await expect(run(removeUser, { data: { userId: 'reserved' }, context })).rejects.toThrow();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each([
    { role: 'admin', cmsRoleId: null },
    { role: 'editor', cmsRoleId: 'basic-profile' },
  ])('assigns exactly the selected invitation role: $role', async assignment => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'basic-profile' }, error: null }) }) }),
      delete: () => ({ eq: deleteEq }), insert,
    }));
    mocks.invite.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    await expect(run(inviteUser, { data: { email: 'invited@example.nl', origin: 'https://oldskool.example.nl', ...assignment }, context })).resolves.toEqual({ ok: true });
    expect(mocks.invite).toHaveBeenCalledWith('invited@example.nl', { redirectTo: 'https://oldskool.example.nl/reset-password' });
    expect(deleteEq).toHaveBeenCalledWith('user_id', 'new-user');
    expect(insert).toHaveBeenCalledExactlyOnceWith({ user_id: 'new-user', role: assignment.role, cms_role_id: assignment.cmsRoleId });
  });
  it('does not allow an editor to invite users even with delegated profile permissions', async () => {
    const editor = { userId: 'editor', supabase: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } };
    await expect(run(inviteUser, { data: { email: 'invited@example.nl', role: 'admin', origin: 'https://oldskool.example.nl', cmsRoleId: null }, context: editor })).rejects.toThrow(/Alleen Administrator/);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('rejects invitations with a missing editor profile before sending email', async () => {
    await expect(run(inviteUser, { data: { email: 'invited@example.nl', role: 'editor', origin: 'https://oldskool.example.nl', cmsRoleId: null }, context })).rejects.toThrow(/Kies een rol/);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
});