import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

beforeEach(() => {
  vi.resetModules();
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute('data-cms-editing');
  Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
  vi.spyOn(navigator, 'webdriver', 'get').mockReturnValue(false);
});

describe('visitor tracking', () => {
  it('executes the lazy RPC instead of only constructing it', async () => {
    const sent = vi.fn();
    rpc.mockImplementation(() => ({ then: (resolve: (value: { error: null }) => void) => {
      sent();
      resolve({ error: null });
    } }));
    const { trackView } = await import('./tracker');
    await trackView('/diensten');
    expect(sent).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('track_view', expect.objectContaining({ _path: '/diensten' }));
  });

  it('deduplicates consecutive views but counts returning after another page', async () => {
    const { trackView } = await import('./tracker');
    await trackView('/');
    await trackView('/');
    await trackView('/diensten');
    await trackView('/');
    expect(rpc.mock.calls.map(call => call[1]._path)).toEqual(['/', '/diensten', '/']);
  });

  it('deduplicates a view while its request is still pending', async () => {
    let finish: ((value: { error: null }) => void) | undefined;
    rpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { trackView } = await import('./tracker');
    const first = trackView('/');
    await trackView('/');
    expect(rpc).toHaveBeenCalledTimes(1);
    if (!finish) throw new Error('Request was not started');
    finish({ error: null });
    await first;
  });

  it.each(['response', 'rejection'])('allows retry after a %s error without breaking the page', async failure => {
    if (failure === 'response') rpc.mockResolvedValueOnce({ error: { message: 'Unavailable' } });
    else rpc.mockRejectedValueOnce(new Error('Offline'));
    const { trackView } = await import('./tracker');
    await expect(trackView('/')).resolves.toBeUndefined();
    await trackView('/');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('keeps visitor and session IDs stable across navigation', async () => {
    window.localStorage.setItem('sw_vid', 'existing-visitor');
    window.sessionStorage.setItem('sw_sid', 'existing-session');
    const { trackView } = await import('./tracker');
    await trackView('/');
    await trackView('/contact');
    for (const call of rpc.mock.calls) {
      expect(call[1]).toMatchObject({ _visitor: 'existing-visitor', _session: 'existing-session' });
    }
  });

  it('uses page-lifetime random IDs when browser storage access is blocked', async () => {
    const blocked = () => { throw new DOMException('Blocked', 'SecurityError'); };
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked);
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(blocked);
    const { trackView } = await import('./tracker');
    await trackView('/');
    await trackView('/contact');
    const first = rpc.mock.calls[0]?.[1];
    const second = rpc.mock.calls[1]?.[1];
    expect(first?._visitor).toMatch(/^[0-9a-f-]{36}$/);
    expect(first?._session).toMatch(/^[0-9a-f-]{36}$/);
    expect(second?._visitor).toBe(first?._visitor);
    expect(second?._session).toBe(first?._session);
  });

  it.each(['/smart-websites', '/smart-websites/sites', '/reset-password', '/invite', '/cms-media/image.webp', '/api/public/cms-version'])('excludes nonvisitor path %s', async path => {
    const { trackView } = await import('./tracker');
    await trackView(path);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['edit', 'preview'])('excludes CMS %s even before the editor initializes', async mode => {
    window.history.replaceState(null, '', '/?cms=' + mode);
    const { trackView } = await import('./tracker');
    await trackView('/');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('excludes an active editor whose marker is an empty attribute', async () => {
    document.documentElement.setAttribute('data-cms-editing', '');
    const { trackView } = await import('./tracker');
    await trackView('/');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('excludes automated browsers', async () => {
    vi.spyOn(navigator, 'webdriver', 'get').mockReturnValue(true);
    const { trackView } = await import('./tracker');
    await trackView('/');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('source and device classification', () => {
  it.each([
    ['', 'Direct / None'], ['https://www.example.nl/contact', 'Direct / None'],
    ['invalid', 'Direct / None'], ['https://www.google.nl/search?q=test', 'Google'],
    ['https://lnkd.in/test', 'LinkedIn'], ['https://other.nl', 'other.nl'],
  ])('classifies %s as %s', async (referrer, source) => {
    const { sourceFrom } = await import('./tracker');
    expect(sourceFrom(referrer, 'example.nl')).toBe(source);
  });

  it.each([
    ['iPhone Mobile', 390, 'Mobile'], ['Android Tablet', 1024, 'Tablet'],
    ['Desktop Browser', 1280, 'Laptop'], ['Desktop Browser', 1920, 'Desktop'],
  ])('classifies %s at %s as %s', async (ua, width, device) => {
    const { deviceFrom } = await import('./tracker');
    expect(deviceFrom(ua, width)).toBe(device);
  });
});