-- Apply after deploying the authenticated API and updating the mobile data client.
-- Existing older APKs that use direct anonymous table access must be updated.
-- This migration changes permissions and conversation ownership; it deletes no records.
BEGIN;

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_id integer REFERENCES public.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_id_unique ON public.conversations(user_id) WHERE user_id IS NOT NULL;

-- Attach a legacy conversation only when both the name and conversation are
-- unambiguous. Ambiguous history stays accessible to administrators for review.
UPDATE public.conversations c
SET user_id = u.id
FROM public.users u
WHERE c.user_id IS NULL AND c.name = u.name
  AND (SELECT count(*) FROM public.users same_user WHERE same_user.name = u.name) = 1
  AND (SELECT count(*) FROM public.conversations same_conversation WHERE same_conversation.name = c.name) = 1
  AND NOT EXISTS (SELECT 1 FROM public.conversations owned WHERE owned.user_id = u.id);

DO $$
DECLARE
  target_table text;
  existing_policy record;
  serial_sequence text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users','lost_items','found_items','matches','messages','conversations',
    'activity_logs','settings','feedback','item_recoveries','recovery_tracking'
  ] LOOP
    IF to_regclass('public.' || target_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    FOR existing_policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = target_table LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, target_table);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', target_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', target_table);
    SELECT pg_get_serial_sequence(format('public.%I', target_table), 'id') INTO serial_sequence
      WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = target_table AND column_name = 'id');
    IF serial_sequence IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', serial_sequence);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', serial_sequence);
    END IF;
  END LOOP;
END $$;

-- Categories and approved campus locations contain public reference data.
-- Keep direct clients read-only; only the authenticated API can manage them.
DO $$
DECLARE target_table text; existing_policy record; serial_sequence text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['categories','qr_locations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    FOR existing_policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = target_table LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, target_table);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', target_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', target_table);
    EXECUTE format('CREATE POLICY reference_reads ON public.%I FOR SELECT TO anon, authenticated USING (true)', target_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', target_table);
    SELECT pg_get_serial_sequence(format('public.%I', target_table), 'id') INTO serial_sequence;
    IF serial_sequence IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', serial_sequence);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', serial_sequence);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
