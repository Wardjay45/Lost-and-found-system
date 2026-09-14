-- Run these ALTER TABLE commands in your Supabase SQL Editor
-- to add the missing embedding columns to existing tables.

ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS text_embedding FLOAT8[];
ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS image_embedding FLOAT8[];

ALTER TABLE found_items ADD COLUMN IF NOT EXISTS text_embedding FLOAT8[];
ALTER TABLE found_items ADD COLUMN IF NOT EXISTS image_embedding FLOAT8[];