DROP POLICY IF EXISTS "Public reads SEO" ON public.page_seo;
DROP POLICY IF EXISTS "Public reads custom pages" ON public.custom_pages;
DROP POLICY IF EXISTS "public read media" ON public.media;
DROP POLICY IF EXISTS "Public reads page settings" ON public.page_settings;
DROP POLICY IF EXISTS "public read settings" ON public.site_settings;
CREATE POLICY "Staff read custom page sources" ON public.custom_pages FOR SELECT TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Staff read site settings" ON public.site_settings FOR SELECT TO authenticated USING (public.can_edit(auth.uid()));

CREATE OR REPLACE FUNCTION public.public_cms_page_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT jsonb_build_object(
'seo',coalesce((SELECT jsonb_agg(jsonb_build_object('path',path,'title',title,'description',description,'noindex',noindex,'nofollow',nofollow,'keywords',keywords,'canonical',canonical,'og_title',og_title,'og_description',og_description,'og_image',og_image,'redirects',redirects)) FROM public.page_seo),'[]'::jsonb),
'settings',coalesce((SELECT jsonb_agg(jsonb_build_object('path',path,'name_nl',name_nl,'name_en',name_en,'hidden_in_menu',hidden_in_menu,'disabled',disabled,'encrypted_url',encrypted_url,'sort_order',sort_order,'deleted',deleted,'parent_path',parent_path)) FROM public.page_settings),'[]'::jsonb),
'custom',coalesce((SELECT jsonb_agg(jsonb_build_object('path',c.path,'source_path',c.source_path)) FROM public.custom_pages c WHERE NOT EXISTS(SELECT 1 FROM public.page_settings s WHERE s.path=c.path AND (s.deleted OR s.disabled))),'[]'::jsonb),
'site_domain',(SELECT site_domain FROM public.site_settings WHERE id=1)) $$;
REVOKE ALL ON FUNCTION public.public_cms_page_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_cms_page_data() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cms_folder_is_published(_folder uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _folder IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.page_content p WHERE p.state='published' AND (
 EXISTS(SELECT 1 FROM jsonb_path_query(p.data,'$.**.gallery.folder') v WHERE v = to_jsonb(_folder::text))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.layout)='array' THEN p.layout ELSE '[]'::jsonb END) b WHERE NOT coalesce((b->>'off')::boolean,false) AND ((b->>'html') LIKE '%data-folder="' || _folder::text || '"%' OR (b->>'html') LIKE '%&quot;folder&quot;:&quot;' || _folder::text || '&quot;%')))) $$;
REVOKE ALL ON FUNCTION public.cms_folder_is_published(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cms_folder_is_published(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cms_file_is_published(_bucket text, _path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _bucket IN ('cms-media','media') AND length(_path) BETWEEN 1 AND 500 AND EXISTS (
 SELECT 1 FROM public.media m WHERE (m.storage_path=_path OR m.path=_path) AND (
 (m.kind='image' AND public.cms_folder_is_published(m.folder_id))
 OR EXISTS(SELECT 1 FROM public.page_content p WHERE p.state='published' AND (
 EXISTS(SELECT 1 FROM jsonb_path_query(p.data,'$.**') v WHERE jsonb_typeof(v)='string' AND v #>> '{}' IN (m.url,'/cms-media/' || _path))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.layout)='array' THEN p.layout ELSE '[]'::jsonb END) b WHERE NOT coalesce((b->>'off')::boolean,false) AND (strpos(b->>'html','"' || m.url || '"')>0 OR strpos(b->>'html','''' || m.url || '''')>0 OR strpos(b->>'html','&quot;' || m.url || '&quot;')>0))))
 OR EXISTS(SELECT 1 FROM public.page_seo s WHERE s.og_image=m.url)) AND (
 (_bucket='cms-media' AND m.url='/cms-media/' || _path)
 OR (_bucket='media' AND m.url LIKE '%/storage/v1/object/%/media/' || _path))) $$;
REVOKE ALL ON FUNCTION public.cms_file_is_published(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cms_file_is_published(text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_cms_gallery(_folder uuid)
RETURNS TABLE(url text,alt text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT m.url,m.alt FROM public.media m WHERE m.folder_id=_folder AND m.kind='image' AND public.cms_folder_is_published(_folder) ORDER BY m.created_at,m.id $$;
REVOKE ALL ON FUNCTION public.public_cms_gallery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_cms_gallery(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public reads cms-media" ON storage.objects;
DROP POLICY IF EXISTS "public read cms media" ON storage.objects;
CREATE POLICY "Editors read cms-media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='cms-media' AND public.can_edit(auth.uid()));
CREATE POLICY "Staff read legacy media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='media' AND public.is_staff(auth.uid()));