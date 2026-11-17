import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { normDomain } from './site-address.ts';
export { normDomain, siteUrlOf } from './site-address.ts';
/** Website domain from Instellingen (site_settings.site_domain); falls back to the current host. */
export function useSiteDomain() {
  const [d, setD] = useState('');
  useEffect(() => {
    void supabase.from('site_settings').select('site_domain').eq('id', 1).maybeSingle()
      .then(({ data }) => setD(normDomain(data?.site_domain || window.location.hostname)));
  }, []);
  return d;
}
