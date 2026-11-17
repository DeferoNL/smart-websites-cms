DROP POLICY IF EXISTS "Editors read forms" ON public.form_submissions;
DROP POLICY IF EXISTS "Editors mark forms" ON public.form_submissions;
DROP POLICY IF EXISTS "Editors delete forms" ON public.form_submissions;
CREATE POLICY "Form readers read submissions" ON public.form_submissions FOR SELECT TO authenticated USING(public.has_perm(auth.uid(),'forms'));
CREATE POLICY "Form managers mark submissions" ON public.form_submissions FOR UPDATE TO authenticated USING(public.has_perm(auth.uid(),'forms')) WITH CHECK(public.has_perm(auth.uid(),'forms'));
CREATE POLICY "Form managers delete submissions" ON public.form_submissions FOR DELETE TO authenticated USING(public.has_perm(auth.uid(),'forms'));
DROP POLICY IF EXISTS "Staff reads backups" ON public.site_backups;
CREATE POLICY "Backup makers read backups" ON public.site_backups FOR SELECT TO authenticated USING(public.has_perm(auth.uid(),'backups'));