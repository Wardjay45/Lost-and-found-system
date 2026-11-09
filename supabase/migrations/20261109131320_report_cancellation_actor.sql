BEGIN;

ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS cancellation_actor jsonb;
ALTER TABLE public.found_items ADD COLUMN IF NOT EXISTS cancellation_actor jsonb;

-- Recover attribution only when an old event matches the report, reason and
-- update time, and all matching events identify the same actor.
DO $$
DECLARE
  target text;
  other_target text;
  report_label text;
BEGIN
  FOREACH target IN ARRAY ARRAY['lost_items', 'found_items'] LOOP
    other_target := CASE target WHEN 'lost_items' THEN 'found_items' ELSE 'lost_items' END;
    report_label := CASE target WHEN 'lost_items' THEN 'Lost' ELSE 'Found' END;
    EXECUTE format($backfill$
      WITH recorded AS (
        SELECT r.id,
          (array_agg(jsonb_build_object('role', l.role, 'name', l.user_name, 'at', l.timestamp AT TIME ZONE 'UTC')
            ORDER BY l.timestamp DESC, l.id DESC))[1] AS actor
        FROM public.%1$I r
        JOIN public.activity_logs l ON l.action = 'cancel'
          AND l.timestamp BETWEEN r.last_updated - interval '2 minutes' AND r.last_updated + interval '2 minutes'
          AND (
            (l.role IN ('admin', 'superadmin') AND
              l.details = %2$L || ' report #' || r.id || ' cancelled (status: cancelled) Reason: ' || btrim(r.cancel_reason) || '.')
            OR (l.role IN ('student', 'admin', 'superadmin') AND
              l.details = 'Report ' || r.item_id || ' cancelled. Reason: ' || r.cancel_reason
              AND NOT EXISTS (SELECT 1 FROM public.%3$I other WHERE other.item_id = r.item_id))
          )
        WHERE r.status = 'cancelled' AND r.cancellation_actor IS NULL
          AND nullif(btrim(r.cancel_reason), '') IS NOT NULL
        GROUP BY r.id
        HAVING count(DISTINCT jsonb_build_array(l.role, l.user_name)) = 1
      )
      UPDATE public.%1$I r SET cancellation_actor = recorded.actor
      FROM recorded WHERE r.id = recorded.id AND r.cancellation_actor IS NULL
    $backfill$, target, report_label, other_target);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_item_report(
  p_table text, p_report_id integer, p_actor_id integer, p_reason text, p_owner_only boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor record;
  report jsonb;
  owner_column text;
  allow_all_reports boolean;
  reason text := btrim(p_reason);
  cancelled_at timestamptz;
BEGIN
  owner_column := CASE p_table WHEN 'lost_items' THEN 'reporter_id' WHEN 'found_items' THEN 'finder_id' END;
  IF owner_column IS NULL OR p_owner_only IS NULL OR reason IS NULL OR char_length(reason) NOT BETWEEN 1 AND 500 THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Enter a cancellation reason of 1–500 characters for a valid report.';
  END IF;

  SELECT id, name, role INTO actor FROM public.users WHERE id = p_actor_id AND status = 'active' FOR SHARE;
  IF NOT FOUND OR actor.role IS NULL OR actor.role NOT IN ('student', 'admin', 'superadmin')
    OR (NOT p_owner_only AND actor.role = 'student') THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'This account cannot cancel the report.';
  END IF;
  allow_all_reports := NOT p_owner_only;

  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE r.id = $1 AND ($2 OR r.%I = $3) FOR UPDATE',
    p_table, owner_column)
    INTO report USING p_report_id, allow_all_reports, actor.id;

  IF report IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'Report not found.'; END IF;
  IF report->>'status' = 'cancelled' THEN RETURN report; END IF;
  IF coalesce(report->>'status', '') NOT IN ('pending', 'active') THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'This report is no longer eligible for that action.';
  END IF;

  cancelled_at := clock_timestamp();
  EXECUTE format('UPDATE public.%I r
    SET status = ''cancelled'', cancel_reason = $2, last_updated = $3 AT TIME ZONE ''UTC'',
      cancellation_actor = $4
    WHERE r.id = $1 RETURNING to_jsonb(r)', p_table)
    INTO report USING p_report_id, reason, cancelled_at,
      jsonb_build_object('id', actor.id, 'name', actor.name, 'role', actor.role, 'at', cancelled_at);

  INSERT INTO public.activity_logs (action, details, user_name, role, timestamp)
  VALUES ('cancel', 'Report ' || (report->>'item_id') || ' cancelled. Reason: ' || reason,
    actor.name, actor.role, cancelled_at AT TIME ZONE 'UTC');

  RETURN report;
END $$;

REVOKE ALL ON FUNCTION public.cancel_item_report(text, integer, integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_item_report(text, integer, integer, text, boolean) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
