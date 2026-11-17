CREATE POLICY "Public reads cms-media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'cms-media');
CREATE POLICY "Editors upload cms-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cms-media' AND public.can_edit(auth.uid()));
CREATE POLICY "Editors update cms-media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cms-media' AND public.can_edit(auth.uid()));
CREATE POLICY "Editors delete cms-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cms-media' AND public.can_edit(auth.uid()));
DROP POLICY IF EXISTS "staff write media" ON public.media;
CREATE POLICY "Editors manage media" ON public.media FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));