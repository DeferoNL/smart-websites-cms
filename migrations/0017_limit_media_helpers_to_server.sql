REVOKE EXECUTE ON FUNCTION public.cms_file_is_published(text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_folder_is_published(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_cms_gallery(uuid) FROM anon, authenticated;
COMMENT ON FUNCTION public.cms_file_is_published(text,text) IS 'Server-only compatibility helper; public file access is authorized against rendered published markup by the application.';
COMMENT ON FUNCTION public.public_cms_gallery(uuid) IS 'Server-only compatibility helper; application public gallery reads validate rendered published folder references first.';