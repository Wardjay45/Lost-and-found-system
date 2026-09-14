-- Run these in the Supabase SQL Editor to add indexes for the
-- Lost & Found tables. The original schema had NO indexes (besides PKs
-- and the unique item_id), so every filtered query did a full table scan.

-- Lost items (filtered by status / category, sorted by date)
CREATE INDEX IF NOT EXISTS idx_lost_items_status          ON lost_items (status);
CREATE INDEX IF NOT EXISTS idx_lost_items_date_reported   ON lost_items (date_reported DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_category_name   ON lost_items (category_name);
CREATE INDEX IF NOT EXISTS idx_lost_items_reporter_id     ON lost_items (reporter_id);

-- Found items
CREATE INDEX IF NOT EXISTS idx_found_items_status          ON found_items (status);
CREATE INDEX IF NOT EXISTS idx_found_items_date_found      ON found_items (date_found DESC);
CREATE INDEX IF NOT EXISTS idx_found_items_category_name   ON found_items (category_name);
CREATE INDEX IF NOT EXISTS idx_found_items_finder_id       ON found_items (finder_id);

-- Matches (joined/looked up by item id on both sides)
CREATE INDEX IF NOT EXISTS idx_matches_lost_item_id   ON matches (lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found_item_id  ON matches (found_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_status         ON matches (status);

-- Messages (looked up by conversation, ordered by time)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_time            ON messages ("time");

-- Activity logs (dashboard lists latest 10)
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs ("timestamp" DESC);

-- Users (filtered by status / looked up by email)
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
