import { z } from 'zod';
import type { PublicCmsPageData } from './public-cms-data.ts';

const fields = {
  seo: z.array(z.object({
    path: z.string(), title: z.string().nullable(), description: z.string().nullable(),
    noindex: z.boolean(), nofollow: z.boolean(), keywords: z.string().nullable(), canonical: z.string().nullable(),
    redirects: z.string().nullable(), og_title: z.string().nullable(), og_description: z.string().nullable(), og_image: z.string().nullable(),
  })),
  settings: z.array(z.object({
    path: z.string(), name_nl: z.string().nullable(), name_en: z.string().nullable(), hidden_in_menu: z.boolean(),
    disabled: z.boolean(), encrypted_url: z.boolean(), sort_order: z.number().nullable(), deleted: z.boolean(), parent_path: z.string().nullable(),
  })),
  custom: z.array(z.object({ path: z.string(), source_path: z.string() })),
};
const currentSchema = z.object({ ...fields, site_domain: z.string().nullable() });
const legacySchema = z.object({ ...fields, site: z.object({ site_domain: z.string().nullable().optional() }) });
type RpcResult = { data: unknown; error: { code?: string } | null };
type PublicRpc = (name: 'public_cms_page_data' | 'public_website_configuration') => PromiseLike<RpcResult>;

/** Only the known missing-function errors permit the legacy public projection. */
export async function readCompatiblePublicCmsData(rpc: PublicRpc): Promise<PublicCmsPageData> {
  const current = await rpc('public_cms_page_data');
  if (!current.error) return currentSchema.parse(current.data);
  if (!['PGRST202', '42883'].includes(current.error.code ?? '')) throw new Error('Websitegegevens konden niet worden geladen.');
  const legacy = await rpc('public_website_configuration');
  if (legacy.error) throw new Error('Openbare websitefunctie ontbreekt of is niet beschikbaar. Laat de benodigde wijziging eerst goedkeuren.');
  const { site, ...pages } = legacySchema.parse(legacy.data);
  const excluded = new Set(pages.settings.filter(row => row.disabled || row.deleted).map(row => row.path));
  return { ...pages, custom: pages.custom.filter(row => !excluded.has(row.path)), site_domain: site.site_domain ?? null };
}