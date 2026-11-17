ALTER TABLE public.block_templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'overig',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS block_templates_fingerprint_key ON public.block_templates (fingerprint);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_templates TO authenticated;
GRANT ALL ON public.block_templates TO service_role;