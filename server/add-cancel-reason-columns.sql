-- Run these ALTER TABLE commands in your Supabase SQL Editor
-- to add the missing cancel_reason column to existing tables.
--
-- The admin web app, the mobile app, and the Express server all
-- store a cancellation reason when a report is cancelled, but the
-- original schema did not include this column. Without it, cancelling
-- a report fails with:
--   "Could not find the 'cancel_reason' column of 'lost_items' in the schema cache"

ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE found_items ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
