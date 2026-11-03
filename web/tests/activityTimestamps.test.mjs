import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseStoredTimestamp, formatCampusDateTime } from '../../shared/timestamps.mjs';
import { activityView } from '../../shared/activityLogs.mjs';

test('stored UTC activity timestamps keep the same instant with or without an explicit offset', () => {
  for (const timestamp of ['2026-11-03T05:30:12.123456', '2026-11-03 05:30:12.123456', '2026-11-03T05:30:12.123Z', '2026-11-03T05:30:12.123+00', '2026-11-03T13:30:12.123+08:00']) {
    assert.equal(parseStoredTimestamp(timestamp).toISOString(), '2026-11-03T05:30:12.123Z', timestamp);
  }
  assert.equal(activityView({ timestamp: 'bad', created_at: '2026-11-03T05:30:12.123' }).timestamp, '2026-11-03T05:30:12.123Z');
  for (const value of [undefined, null, '', 'bad', new Date('bad')]) {
    assert.equal(parseStoredTimestamp(value), null);
    assert.equal(formatCampusDateTime(value), 'Time not recorded');
  }
});

test('activity dates display Philippine time regardless of the computer timezone', () => {
  const timestamp = '2026-11-03T05:30:00';
  const expected = formatCampusDateTime(timestamp);
  assert.match(expected, /01:30\s*pm/i);
  assert.match(expected, /GMT\+8/);
  const script = `import { parseStoredTimestamp, formatCampusDateTime } from ${JSON.stringify(new URL('../../shared/timestamps.mjs', import.meta.url).href)}; console.log(JSON.stringify([parseStoredTimestamp(${JSON.stringify(timestamp)}).toISOString(),formatCampusDateTime(${JSON.stringify(timestamp)})]));`;
  for (const zone of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['2026-11-03T05:30:00.000Z', expected], zone);
  }
});
