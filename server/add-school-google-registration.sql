BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Female', 'Male', 'Non-binary', 'Prefer not to say')),
  ADD COLUMN IF NOT EXISTS google_subject TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique ON public.users (google_subject);

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.users'::regclass) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Legacy user profile reads" ON public.users';
    EXECUTE 'CREATE POLICY "Legacy user profile reads" ON public.users FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Legacy user profile updates" ON public.users';
    EXECUTE 'CREATE POLICY "Legacy user profile updates" ON public.users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School registration requires trusted server" ON public.users;
CREATE POLICY "School registration requires trusted server" ON public.users
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.protect_google_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    NEW.google_subject IS DISTINCT FROM OLD.google_subject OR
    (OLD.google_subject IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email)
  ) THEN
    RAISE EXCEPTION 'Google identity can only be changed by the trusted registration server';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_google_identity() FROM PUBLIC;
DROP TRIGGER IF EXISTS protect_google_identity ON public.users;
CREATE TRIGGER protect_google_identity
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION private.protect_google_identity();

COMMIT;
