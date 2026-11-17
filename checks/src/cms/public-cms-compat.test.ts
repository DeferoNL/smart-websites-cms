import { describe, expect, it, vi } from 'vitest';
import { readCompatiblePublicCmsData } from '../lib/public-cms-compat';

describe('public website function compatibility', () => {
  const pages = { seo: [], settings: [], custom: [] };
  it('uses the master projection without a fallback', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...pages, site_domain: 'master.nl', owner_email: 'private' }, error: null });
    expect(await readCompatiblePublicCmsData(rpc)).toEqual({ ...pages, site_domain: 'master.nl' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('normalizes the existing client projection only when the master function is missing', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
      .mockResolvedValueOnce({ data: { ...pages, site: { site_domain: 'gertrozendaalstukadoor.nl', owner_email: 'private' } }, error: null });
    expect(await readCompatiblePublicCmsData(rpc)).toEqual({ ...pages, site_domain: 'gertrozendaalstukadoor.nl' });
    expect(rpc.mock.calls.map(call => call[0])).toEqual(['public_cms_page_data', 'public_website_configuration']);
  });
  it('does not bypass access-denied failures', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(readCompatiblePublicCmsData(rpc)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('preserves disabled, deleted and private-menu flags and accepts an unset client domain', async () => {
    const setting = { path: '/nl/private', name_nl: null, name_en: null, hidden_in_menu: true, disabled: true, encrypted_url: true, sort_order: null, deleted: true, parent_path: null };
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: '42883' } })
      .mockResolvedValueOnce({ data: { ...pages, settings: [setting], custom: [{ path: '/nl/private', source_path: '/nl' }], site: { site_domain: null } }, error: null });
    expect(await readCompatiblePublicCmsData(rpc)).toEqual({ ...pages, settings: [setting], site_domain: null });
  });
  it('fails closed when both functions are unavailable or data is invalid', async () => {
    const missing = vi.fn().mockResolvedValue({ data: null, error: { code: '42883' } });
    await expect(readCompatiblePublicCmsData(missing)).rejects.toThrow(/goedkeuren/);
    await expect(readCompatiblePublicCmsData(vi.fn().mockResolvedValue({ data: {}, error: null }))).rejects.toThrow();
  });
});