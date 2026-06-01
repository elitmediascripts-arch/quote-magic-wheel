
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT,
  logo_url TEXT,
  followup_day2_subject TEXT NOT NULL DEFAULT 'Quick follow-up on your quote',
  followup_day2_body TEXT NOT NULL DEFAULT 'Hi {{client_name}},

Just checking in on the quote I sent over a couple of days ago. Let me know if you have any questions!

You can review it here: {{quote_link}}

Thanks!',
  followup_day5_subject TEXT NOT NULL DEFAULT 'Still interested?',
  followup_day5_body TEXT NOT NULL DEFAULT 'Hi {{client_name}},

Wanted to circle back one more time on the quote. Happy to adjust anything if needed.

Review here: {{quote_link}}

Thanks!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own settings" ON public.user_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Logos are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Users upload own logo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own logo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own logo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
