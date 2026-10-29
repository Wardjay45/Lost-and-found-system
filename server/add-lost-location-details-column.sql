-- Optional details about the place where a lost item went missing.
-- Apply to existing Supabase databases before accepting this mobile field.
ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS location_details TEXT;

-- Make the new field available to mobile clients using the Supabase Data API.
NOTIFY pgrst, 'reload schema';
