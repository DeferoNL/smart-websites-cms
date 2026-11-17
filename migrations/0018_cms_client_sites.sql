CREATE TABLE public.cms_client_sites (
  host text PRIMARY KEY CHECK (char_length(host) BETWEEN 3 AND 253),
  site_name text CHECK (site_name IS NULL OR char_length(site_name) <= 120),
  version text NOT NULL CHECK (char_length(version) <= 20),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_client_sites TO authenticated;
GRANT ALL ON public.cms_client_sites TO service_role;
ALTER TABLE public.cms_client_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read client sites" ON public.cms_client_sites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));