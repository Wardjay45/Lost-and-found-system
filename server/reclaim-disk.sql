-- ================================================
-- Supabase Disk Reclaim — Lost & Found
-- ================================================
-- Run these one block at a time in the Supabase SQL Editor.

-- 1) Overall database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- 2) Biggest relations across EVERY schema (auth, storage, public, etc.)
--    This is the key query: the app's anon key cannot see auth/storage,
--    but the SQL Editor runs as postgres and sees everything.
SELECT
  n.nspname AS schema,
  c.relname AS relation,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'm', 'i')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 30;

-- 2b) Schema-level summary (auth vs storage vs public)
SELECT
  schemaname,
  pg_size_pretty(sum(pg_total_relation_size(schemaname || '.' || tablename))) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname
ORDER BY sum(pg_total_relation_size(schemaname || '.' || tablename)) DESC;

-- 3) How much space base64 images are eating (stored directly in the DB)
SELECT 'lost_items' AS table_name,
       count(*) AS base64_rows,
       pg_size_pretty(sum(length(image))) AS base64_size
FROM lost_items
WHERE image LIKE 'data:image/%'
UNION ALL
SELECT 'found_items',
       count(*),
       pg_size_pretty(sum(length(image)))
FROM found_items
WHERE image LIKE 'data:image/%';

-- 4) IMMEDIATE relief: drop base64 photos from already-closed reports.
--    Keeps the row + description, removes the oversized image data.
UPDATE lost_items
SET image = NULL
WHERE image LIKE 'data:image/%'
  AND status IN ('cancelled', 'resolved', 'claimed');

UPDATE found_items
SET image = NULL
WHERE image LIKE 'data:image/%'
  AND status IN ('cancelled', 'resolved', 'claimed');

-- 5) OPTIONAL: after running server/migrate-images-to-storage.mjs,
--    NULL out any remaining base64 images (photos are now in Storage).
--    Only run these AFTER migration, or you will lose the photos.
-- UPDATE lost_items  SET image = NULL WHERE image LIKE 'data:image/%';
-- UPDATE found_items SET image = NULL WHERE image LIKE 'data:image/%';

-- 6) Reclaim freed space. VACUUM FULL rewrites tables compactly so the
--    disk quota reflects the freed space. It locks the table, so run it
--    when traffic is low. Start with regular VACUUM if you prefer non-blocking.
-- VACUUM FULL lost_items;
-- VACUUM FULL found_items;
