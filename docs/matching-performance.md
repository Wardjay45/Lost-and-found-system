# Matching preparation and reuse

The database stores report embeddings, not a permanent similarity score for every
possible lost/found pair. Cosine comparison is inexpensive once compatible
embeddings are available. Preparing image/text features and loading AI models is
the costly part.

Smart matching previously forced feature regeneration on live refresh and on
Recalculate matches. It also ignored the saved E5 text embeddings and kept its
model-specific features only in a short-lived memory cache.

The updated path:

- Reuses valid saved E5-base-v2 text embeddings directly.
- Keeps every matching model's feature cache separate. Existing raw CLIP vectors
  are not substituted for vectors from the report-photo preprocessing pipeline.
- Prepares the default CLIP report features during background report preparation,
  including the local API's poller for reports submitted directly by mobile.
- Retains prepared features on local disk for up to seven days, with periodic
  cleanup, so an API restart does not require processing every image again.
- Shares unfinished preparation between overlapping requests, so a background
  job and the matching page do not run the same AI inference twice.
- Reuses features during normal automatic/manual refresh while recalculating
  scores against the current active reports. A changed description/photo causes
  new preparation; approval alone retains image features when the saved image
  fingerprint is unchanged.

The default local cache is `server/.cache/report-features/` and is excluded from
Git. Cache files contain opaque content hashes and numeric features, without
report descriptions or photographs. `REPORT_FEATURE_CACHE_DIR` can select a
server-owned persistent directory. A missing, corrupt, expired or unwritable
cache falls back to preparing features; matching does not depend on disk writes.

On Vercel, the default cache uses `/tmp`. Persistence across separate cold
instances or deployments is not guaranteed. The first use of an alternative
model or an uncached image can still require AI processing. Direct mobile inserts
also wait for the existing local server poller; preparation is asynchronous.
No database migration is required for these changes.

Focused tests check saved E5 reuse without AI calls, model isolation, background
preparation followed by a fresh memory cache, changed photos, and explicit
`refresh: true` requests. That explicit API option still forces feature rebuilding
for troubleshooting; the normal admin refresh does not send it.
