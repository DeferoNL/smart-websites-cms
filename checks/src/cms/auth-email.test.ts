import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';

const { handler, identity } = vi.hoisted(() => ({ handler: vi.fn(), identity: vi.fn() }));
vi.mock('@lovable.dev/email-js', () => ({ createAuthEmailHandler: handler }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/lib/email-templates/identity.server', () => ({ loadEmailIdentity: identity }));
import { Route } from '../routes/lovable/email/auth/webhook';

type EmailConfig = {
  from: { name: string; address: string };
  senderDomain: string;
  emails: Record<string, { render: (data: { email: string; url: string }) => Promise<unknown> }>;
};
describe('verified auth email handoff', () => {
  beforeEach(() => {
    handler.mockReset().mockReturnValue(vi.fn().mockResolvedValue(new Response('ok')));
    identity.mockReset().mockResolvedValue({ siteName: 'Oldskool Outdoor', siteUrl: 'https://oldskool.example.nl' });
  });
  it.each(['invite', 'recovery'])('preserves the verified %s URL and resolves the website identity', async type => {
    const route = Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } };
    await route.server.handlers.POST({ request: new Request('https://client.example/lovable/email/auth/webhook', { method: 'POST' }) });
    const config = handler.mock.lastCall?.[0] as EmailConfig | undefined;
    if (!config) throw new Error('Email handler was not configured');
    expect(config.from).toEqual({ name: 'SMART Websites', address: 'noreply@smart-websites.nl' });
    expect(config.senderDomain).toBe('notify.smart-websites.nl');
    // Identity is not loaded until the SDK renders a verified email.
    expect(identity).not.toHaveBeenCalled();
    const email = config.emails[type];
    if (!email) throw new Error('Missing auth template');
    const url = `https://auth.example/verify?type=${type}&redirect_to=https%3A%2F%2Foldskool.example.nl%2Freset-password`;
    const rendered = await email.render({ email: 'test@example.nl', url });
    if (!isValidElement<{ siteName: string; siteUrl?: string; confirmationUrl: string }>(rendered)) throw new Error('Missing email');
    expect(rendered.props.siteName).toBe('Oldskool Outdoor');
    if (type === 'invite') expect(rendered.props.siteUrl).toBe('https://oldskool.example.nl');
    expect(rendered.props.confirmationUrl).toBe(url);
  });
});