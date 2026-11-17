ALTER TABLE public.cms_client_sites ADD COLUMN IF NOT EXISTS stats jsonb, ADD COLUMN IF NOT EXISTS token_hash text;

CREATE TABLE IF NOT EXISTS public.cms_site_token (id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), token text NOT NULL);
GRANT ALL ON public.cms_site_token TO service_role;
ALTER TABLE public.cms_site_token ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cms_site_stats() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT jsonb_build_object(
    'users', (SELECT count(DISTINCT user_id) FROM public.user_roles),
    'admins', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'admin'),
    'no_2fa', (SELECT count(DISTINCT r.user_id) FROM public.user_roles r WHERE NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = r.user_id AND f.status = 'verified')),
    'drafts', (SELECT count(*) FROM public.page_content WHERE state = 'draft'),
    'last_publish', (SELECT max(updated_at) FROM public.page_content WHERE state = 'published'),
    'unread_forms', (SELECT count(*) FROM public.form_submissions WHERE NOT is_read),
    'installed', (SELECT coalesce(bool_or(completed_at IS NOT NULL), false) FROM public.cms_installation)
  )
$$;
REVOKE ALL ON FUNCTION public.cms_site_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_site_stats() TO service_role;