-- Requires server/secure-data-access.sql for account-owned conversations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.found_item_reminder_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  delay_hours integer NOT NULL DEFAULT 24 CHECK (delay_hours BETWEEN 1 AND 720),
  message text NOT NULL DEFAULT 'Please bring the item you reported to the OSDS office so staff can verify ownership and return it to its rightful owner.'
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000)
);
ALTER TABLE public.found_item_reminder_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.found_item_reminder_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.found_item_reminder_settings TO service_role;
INSERT INTO public.found_item_reminder_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.found_items ADD COLUMN IF NOT EXISTS turnover_reminded_at timestamptz;
CREATE INDEX IF NOT EXISTS found_items_due_turnover_reminder
  ON public.found_items (date_found, id)
  WHERE status = 'pending' AND turnover_reminded_at IS NULL AND finder_id IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.send_found_item_turnover_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  settings public.found_item_reminder_settings%ROWTYPE;
  report record;
  office_conversation integer;
  sent_count integer := 0;
  run_at timestamptz := now();
BEGIN
  -- Serialize runs and settings changes. Each report lock also orders a send
  -- against staff receipt confirmation and cancellation of that report.
  SELECT * INTO STRICT settings FROM public.found_item_reminder_settings WHERE id = 1 FOR UPDATE;
  IF NOT settings.enabled THEN RETURN 0; END IF;

  FOR report IN
    SELECT f.id, f.item_id, f.finder_id, u.name AS finder_name
    FROM public.found_items f
    JOIN public.users u ON u.id = f.finder_id AND u.status = 'active'
    WHERE f.status = 'pending' AND f.turnover_reminded_at IS NULL AND f.finder_id IS NOT NULL
      AND f.date_found <= (run_at AT TIME ZONE 'UTC') - make_interval(hours => settings.delay_hours)
    ORDER BY f.date_found, f.id
    LIMIT 100
    FOR UPDATE OF f SKIP LOCKED
  LOOP
    -- Only account-owned conversations can receive an automatic message.
    INSERT INTO public.conversations (user_id, name, avatar)
    VALUES (report.finder_id, report.finder_name, upper(left(report.finder_name, 1)))
    ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

    SELECT id INTO STRICT office_conversation FROM public.conversations WHERE user_id = report.finder_id;

    INSERT INTO public.messages (conversation_id, sender, text, time, created_at)
    VALUES (office_conversation::text, 'admin', settings.message || E'\n\nFound report: ' || report.item_id,
      run_at AT TIME ZONE 'UTC', run_at AT TIME ZONE 'UTC');

    INSERT INTO public.activity_logs (action, details, user_name, role, timestamp)
    VALUES ('turnover_reminder', 'Automatic OSDS turnover reminder sent for found report ' || report.item_id || '.',
      'System', 'system', run_at AT TIME ZONE 'UTC');

    UPDATE public.found_items SET turnover_reminded_at = run_at WHERE id = report.id;
    sent_count := sent_count + 1;
  END LOOP;

  RETURN sent_count;
END;
$$;

REVOKE ALL ON FUNCTION private.send_found_item_turnover_reminders() FROM PUBLIC, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('found-item-turnover-reminders', '* * * * *', 'SELECT private.send_found_item_turnover_reminders()');

NOTIFY pgrst, 'reload schema';
COMMIT;
