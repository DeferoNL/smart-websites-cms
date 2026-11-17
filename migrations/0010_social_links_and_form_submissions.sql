ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS social jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL DEFAULT '',
  form_name text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_data_size CHECK (pg_column_size(data) < 20000 AND char_length(page) < 300 AND char_length(form_name) < 120)
);
GRANT INSERT ON public.form_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitors submit forms" ON public.form_submissions FOR INSERT TO anon, authenticated WITH CHECK (is_read = false);
CREATE POLICY "Editors read forms" ON public.form_submissions FOR SELECT TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Editors mark forms" ON public.form_submissions FOR UPDATE TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Editors delete forms" ON public.form_submissions FOR DELETE TO authenticated USING (public.can_edit(auth.uid()));
CREATE INDEX form_submissions_created_idx ON public.form_submissions (created_at DESC);