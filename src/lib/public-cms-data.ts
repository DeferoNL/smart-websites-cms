import type { Database } from '@/integrations/supabase/types';

/** Explicit public projection; never return CMS ownership or audit fields. */
export type PublicCmsPageData = {
  seo: Pick<Database['public']['Tables']['page_seo']['Row'], 'path' | 'title' | 'description' | 'noindex' | 'nofollow' | 'keywords' | 'canonical' | 'og_title' | 'og_description' | 'og_image' | 'redirects'>[];
  settings: Pick<Database['public']['Tables']['page_settings']['Row'], 'path' | 'name_nl' | 'name_en' | 'hidden_in_menu' | 'disabled' | 'encrypted_url' | 'sort_order' | 'deleted' | 'parent_path'>[];
  custom: { path: string; source_path: string }[];
  site_domain: string | null;
};