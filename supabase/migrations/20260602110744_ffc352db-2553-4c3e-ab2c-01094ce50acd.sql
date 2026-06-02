CREATE TABLE public.service_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_templates TO authenticated;
GRANT ALL ON public.service_templates TO service_role;

ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own templates" ON public.service_templates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert own templates" ON public.service_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own templates" ON public.service_templates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete own templates" ON public.service_templates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER service_templates_set_updated_at
  BEFORE UPDATE ON public.service_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_service_templates_user ON public.service_templates(user_id, created_at DESC);