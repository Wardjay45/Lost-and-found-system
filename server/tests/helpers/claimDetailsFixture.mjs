import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { categoryFixture } from './categoriesFixture.mjs';

export async function claimDetailsFixture() {
  const f = await categoryFixture();
  await f.db.exec(await readFile(new URL('../../add-recovery-feedback.sql', import.meta.url), 'utf8'));
  await f.db.exec(await readFile(new URL('../../cancel-potential-match.sql', import.meta.url), 'utf8'));
  await f.db.exec(await readFile(new URL('../../add-handover-photo.sql', import.meta.url), 'utf8'));
  await f.db.exec(`INSERT INTO users(id,name,email,password,role,status) VALUES(1,'Owner','owner@example.invalid','fixture','student','active');
    INSERT INTO lost_items(id,item_id,description,location_lost,location_details,status,reporter_id,reporter_name) VALUES(10,'L10','Blue bag','Library','Second floor','active',1,'Owner');
    INSERT INTO found_items(id,item_id,description,location_found,location_details,status,finder_name,condition) VALUES(20,'F20','Blue bag','Library','Front desk','active','Finder','Good');`);
  const client = { from(table) {
    if (table !== 'item_recoveries') return f.writer.from(table);
    let columns, field, id;
    const q = {
      select(value) { assert.ok(value === '*' || /^[a-z_,]+$/.test(value)); columns = value; return q; },
      eq(key, value) { assert.ok(['id', 'owner_id', 'lost_item_id', 'found_item_id'].includes(key)); field = key; id = value; return q; },
      order() { return q; },
      async range(start, end) {
        try { return { data: (await f.db.query(`SELECT ${columns} FROM item_recoveries${field ? ` WHERE ${field}=$1` : ''} ORDER BY id`, field ? [id] : [])).rows.slice(start, end + 1), error: null }; }
        catch (error) { return { data: null, error }; }
      },
      async maybeSingle() {
        try { return { data: (await f.db.query(`SELECT ${columns} FROM item_recoveries WHERE ${field}=$1`, [id])).rows[0] || null, error: null }; }
        catch (error) { return { data: null, error }; }
      },
    };
    return q;
  }, async rpc(name, args) {
    assert.equal(name, 'complete_item_recovery_with_evidence');
    try { return { data: (await f.db.query('SELECT complete_item_recovery_with_evidence($1,$2,$3,$4,$5,$6) AS result', [args.p_lost_id, args.p_found_id, args.p_admin_id, args.p_notes, args.p_handover_image, args.p_knowledge_answers])).rows[0].result, error: null }; }
    catch (error) { return { data: null, error }; }
  } };
  const complete = async (notes = 'Q&A: Blue lining and a small key in the pocket. Released to owner.') =>
    (await f.db.query('SELECT complete_item_recovery($1,$2,$3,$4) AS result', [10, 20, 7, notes])).rows[0].result;
  return { ...f, client, complete };
}
