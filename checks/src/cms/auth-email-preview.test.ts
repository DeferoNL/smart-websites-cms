import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';

const { render, identity } = vi.hoisted(() => ({ render: vi.fn(), identity: vi.fn() }));
vi.mock('@react-email/render', () => ({ render }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/lib/email-templates/identity.server', () => ({ loadEmailIdentity: identity }));
import { Route } from '../routes/lovable/email/auth/preview';

describe('auth email preview project identity', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it('uses the configured website identity for invitation previews and test emails', async () => {
    vi.stubEnv('LOVABLE_API_KEY', 'test-preview-key');
    identity.mockResolvedValue({ siteName: 'Oldskool Outdoor', siteUrl: 'https://oldskool.nl' });
    render.mockResolvedValue('rendered email');
    const route = Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } };
    const response = await route.server.handlers.POST({ request: new Request('https://client.example/lovable/email/auth/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-preview-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invite' }),
    }) });
    expect(response.status).toBe(200);
    const email = render.mock.lastCall?.[0];
    if (!isValidElement<{ siteName: string; siteUrl: string }>(email)) throw new Error('Missing preview email');
    expect(email.props.siteName).toBe('Oldskool Outdoor');
    expect(email.props.siteUrl).toBe('https://oldskool.nl');
  });
});