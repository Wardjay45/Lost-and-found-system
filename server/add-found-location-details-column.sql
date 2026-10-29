-- Optional details about the place where a found item was discovered.
-- Apply to existing Supabase databases before accepting this mobile field.
ALTER TABLE public.found_items ADD COLUMN IF NOT EXISTS location_details TEXT;

-- Make the new field available to mobile clients using the Supabase Data API.
NOTIFY pgrst, 'reload schema';
