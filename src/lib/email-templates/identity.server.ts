import { emailProjectName } from './identity.ts'
import { siteUrlOf } from '../../cms/site-address.ts'

export async function loadEmailIdentity(): Promise<{ siteName: string; siteUrl: string }> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin.from('site_settings').select('project_name, site_domain').eq('id', 1).maybeSingle()
    return { siteName: emailProjectName(data), siteUrl: siteUrlOf(data?.site_domain ?? '') }
  } catch {
    // Auth emails must remain deliverable even if website settings are unavailable.
    return { siteName: emailProjectName(null), siteUrl: '' }
  }
}