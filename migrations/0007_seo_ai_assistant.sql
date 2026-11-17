ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS seo_ai_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own usage read" ON public.ai_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own usage insert" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_edit(auth.uid()));
CREATE INDEX ai_usage_user_time ON public.ai_usage (user_id, created_at);