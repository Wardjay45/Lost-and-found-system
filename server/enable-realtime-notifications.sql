-- Enable admin live-data subscriptions without changing row access policies.
-- Idempotent: preserve all existing publication tables and RLS policies.
DO $$
DECLARE table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND puballtables) THEN
    FOREACH table_name IN ARRAY ARRAY['lost_items', 'found_items', 'matches', 'activity_logs', 'messages', 'conversations', 'categories', 'users', 'qr_locations', 'feedback', 'item_recoveries'] LOOP
      IF to_regclass(format('public.%I', table_name)) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END $$;
