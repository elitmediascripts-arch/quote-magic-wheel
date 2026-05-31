
-- Enum for quote status
CREATE TYPE public.quote_status AS ENUM ('sent', 'viewed', 'accepted', 'declined');

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  service_description TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.quote_status NOT NULL DEFAULT 'sent',
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  reminder_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quotes_user_id_idx ON public.quotes(user_id);
CREATE INDEX quotes_share_token_idx ON public.quotes(share_token);
CREATE INDEX quotes_status_created_idx ON public.quotes(status, created_at);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, UPDATE ON public.quotes TO anon;
GRANT ALL ON public.quotes TO service_role;

-- RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Owners: full access to their quotes
CREATE POLICY "Owners can view own quotes"
  ON public.quotes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert own quotes"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own quotes"
  ON public.quotes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete own quotes"
  ON public.quotes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Note: public share-link reads/updates are done via a server function
-- using the admin client, so no anon RLS policies are needed.

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
