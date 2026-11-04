-- Apply after add-recovery-feedback.sql and cancel-potential-match.sql, before deploying the updated API.
-- Existing handovers remain unchanged; evidence is protected by item_recoveries RLS and server-only access.
BEGIN;
ALTER TABLE public.item_recoveries ADD COLUMN IF NOT EXISTS handover_image text;
ALTER TABLE public.item_recoveries ADD COLUMN IF NOT EXISTS knowledge_answers text;

CREATE OR REPLACE FUNCTION public.complete_item_recovery_with_evidence(p_lost_id integer, p_found_id integer, p_admin_id integer, p_notes text, p_handover_image text, p_knowledge_answers text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  lost public.lost_items%ROWTYPE;
  found_report public.found_items%ROWTYPE;
  administrator public.users%ROWTYPE;
  recovered public.item_recoveries%ROWTYPE;
  entry record;
  details jsonb;
  latest_found text;
  latest_lost text;
  completed_at timestamptz := now();
BEGIN
  SELECT * INTO administrator FROM public.users WHERE id = p_admin_id AND role IN ('admin', 'superadmin') AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active administrator must confirm the handover.'; END IF;
  IF p_notes IS NULL OR length(p_notes) > 1000 THEN RAISE EXCEPTION 'Verification notes must be at most 1,000 characters.'; END IF;
  IF p_knowledge_answers IS NULL OR length(btrim(p_knowledge_answers)) = 0 OR length(p_knowledge_answers) > 1000 OR lower(btrim(p_knowledge_answers)) IN ('n/a', 'na', 'n/a.', 'na.') THEN
    RAISE EXCEPTION 'Record the ownership questions and answers before releasing the item.';
  END IF;

  IF p_handover_image IS NULL OR length(p_handover_image) > 1398144 OR p_handover_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' THEN
    RAISE EXCEPTION 'Upload a valid handover photo before releasing the item.';
  END IF;

  SELECT * INTO lost FROM public.lost_items WHERE id = p_lost_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lost report not found.'; END IF;
  SELECT * INTO found_report FROM public.found_items WHERE id = p_found_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Found report not found.'; END IF;

  SELECT * INTO recovered FROM public.item_recoveries WHERE lost_item_id = p_lost_id OR found_item_id = p_found_id;
  IF FOUND THEN
    IF recovered.lost_item_id = p_lost_id AND recovered.found_item_id = p_found_id THEN RETURN to_jsonb(recovered); END IF;
    RAISE EXCEPTION 'One of these items has already been returned in another handover.';
  END IF;
  IF lost.reporter_id IS NULL OR lost.status NOT IN ('potential_match', 'matched') OR found_report.status NOT IN ('potential_match', 'matched') THEN
    RAISE EXCEPTION 'These reports are not eligible for a verified handover.';
  END IF;
  FOR entry IN SELECT activity.details AS payload FROM public.activity_logs AS activity WHERE activity.action = 'match' ORDER BY activity.timestamp DESC, activity.id DESC LOOP
    BEGIN details := entry.payload::jsonb; EXCEPTION WHEN OTHERS THEN CONTINUE; END;
    IF latest_found IS NULL AND details->>'lost_item_id' = p_lost_id::text THEN latest_found := details->>'found_item_id'; END IF;
    IF latest_lost IS NULL AND details->>'found_item_id' = p_found_id::text THEN latest_lost := details->>'lost_item_id'; END IF;
    EXIT WHEN latest_found IS NOT NULL AND latest_lost IS NOT NULL;
  END LOOP;
  IF (latest_found IS NOT NULL AND latest_found <> p_found_id::text) OR (latest_lost IS NOT NULL AND latest_lost <> p_lost_id::text) THEN
    RAISE EXCEPTION 'The selected reports do not match the current item association.';
  END IF;
  IF NOT (coalesce(latest_found = p_found_id::text AND latest_lost = p_lost_id::text, false)) AND NOT EXISTS (
    SELECT 1 FROM public.matches WHERE lost_item_id = p_lost_id AND found_item_id = p_found_id AND status IN ('confirmed', 'matched', 'potential_match')
  ) THEN RAISE EXCEPTION 'Confirm the lost and found item association before handover.'; END IF;

  INSERT INTO public.item_recoveries(lost_item_id, found_item_id, owner_id, verified_by_id, verified_by_name, item_description, reported_at, recovered_at, notes, handover_image, knowledge_answers)
    VALUES(p_lost_id, p_found_id, lost.reporter_id, administrator.id, administrator.name, lost.description, lost.date_reported AT TIME ZONE 'UTC', completed_at, p_notes, p_handover_image, btrim(p_knowledge_answers))
    RETURNING * INTO recovered;
  UPDATE public.lost_items SET status = 'claimed', resolved_date = completed_at AT TIME ZONE 'UTC', last_updated = completed_at AT TIME ZONE 'UTC' WHERE id = p_lost_id;
  UPDATE public.found_items SET status = 'claimed', resolved_date = completed_at AT TIME ZONE 'UTC', last_updated = completed_at AT TIME ZONE 'UTC' WHERE id = p_found_id;
  UPDATE public.matches SET status = 'claimed' WHERE lost_item_id = p_lost_id AND found_item_id = p_found_id;
  UPDATE public.users SET items_claimed = coalesce(items_claimed, 0) + 1 WHERE id = lost.reporter_id;
  INSERT INTO public.activity_logs(action, details, user_name, role, timestamp) VALUES ('Item Claimed', jsonb_build_object(
    'text', 'Verified handover completed. ID Verified: Yes. Knowledge Check: Passed.',
    'lost_item_id', p_lost_id, 'found_item_id', p_found_id, 'recovery_id', recovered.id, 'verified_by_id', administrator.id, 'notes', p_notes, 'handover_photo_recorded', true, 'knowledge_answers', btrim(p_knowledge_answers)
  )::text, administrator.name, 'admin', completed_at AT TIME ZONE 'UTC');
  RETURN to_jsonb(recovered);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_item_recovery_with_evidence(integer, integer, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_item_recovery_with_evidence(integer, integer, integer, text, text, text) TO service_role;



NOTIFY pgrst, 'reload schema';
COMMIT;
