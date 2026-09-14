-- ========================================
-- Supabase RLS Policies — Allow Mobile App Access
-- ========================================
-- The mobile app uses the anonymous key to insert/select data.
-- These policies enable direct mobile app access via anon key.

-- === lost_items ===
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to lost_items" ON lost_items;
CREATE POLICY "Allow all access to lost_items" ON lost_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- === found_items ===
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to found_items" ON found_items;
CREATE POLICY "Allow all access to found_items" ON found_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- === users ===
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select insert update on users" ON users;
CREATE POLICY "Allow select insert update on users" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- === categories ===
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select on categories" ON categories;
CREATE POLICY "Allow select on categories" ON categories
  FOR SELECT
  USING (true);

-- === messages ===
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to messages" ON messages;
CREATE POLICY "Allow all access to messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- === conversations ===
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to conversations" ON conversations;
CREATE POLICY "Allow all access to conversations" ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- === matches ===
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to matches" ON matches;
CREATE POLICY "Allow all access to matches" ON matches
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- === qr_locations ===
ALTER TABLE qr_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to qr_locations" ON qr_locations;
CREATE POLICY "Allow all access to qr_locations" ON qr_locations
  FOR ALL
  USING (true)
  WITH CHECK (true);

