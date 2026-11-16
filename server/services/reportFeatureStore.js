import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Local installs retain features across API restarts. On serverless hosts /tmp
// is best-effort: a cold instance may still need to prepare its own features.
const defaultDirectory = process.env.REPORT_FEATURE_CACHE_DIR || (process.env.VERCEL
  ? join(tmpdir(), 'lost-found-report-features')
  : fileURLToPath(new URL('../.cache/report-features/', import.meta.url)));
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function createReportFeatureStore(directory = defaultDirectory) {
  const pathFor = key => join(directory, createHash('sha256').update(key).digest('hex') + '.json');
  let lastPrune = 0;
  const prune = async () => {
    if (Date.now() - lastPrune < 15 * 60 * 1000) return;
    lastPrune = Date.now();
    const entries = await readdir(directory);
    const files = await Promise.all(entries.filter(name => /^[a-f0-9]{64}\.json$/.test(name)).map(async name => ({ path: join(directory, name), modified: (await stat(join(directory, name))).mtimeMs })));
    files.sort((a, b) => b.modified - a.modified);
    await Promise.allSettled(files.filter((file, index) => index >= 4096 || Date.now() - file.modified > MAX_AGE).map(file => unlink(file.path)));
  };
  return {
    async get(key) {
      try {
        const path = pathFor(key);
        if (Date.now() - (await stat(path)).mtimeMs > MAX_AGE) { await unlink(path); return null; }
        const saved = JSON.parse(await readFile(path, 'utf8'));
        return saved.key === key ? saved.vector : null;
      } catch { return null; }
    },
    async set(key, vector) {
      const temporary = pathFor(key) + '.' + randomUUID() + '.tmp';
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(temporary, JSON.stringify({ key, vector: Array.from(vector) }), { mode: 0o600 });
        await rename(temporary, pathFor(key));
        await prune();
      } catch {
        // A read-only host must not turn a valid matching result into a failure.
        await unlink(temporary).catch(() => {});
      }
    },
  };
}

export const reportFeatureStore = createReportFeatureStore();
