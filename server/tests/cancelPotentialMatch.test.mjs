import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { categoryFixture } from './helpers/categoriesFixture.mjs';
import { createActivityLogsRouter } from '../routes/activityLogs.js';
import { loadSavedPotentialMatch } from '../services/potentialMatches.js';

const recovery = readFileSync(new URL('../add-recovery-feedback.sql', import.meta.url),'utf8');
const upgrade = readFileSync(new URL('../cancel-potential-match.sql', import.meta.url),'utf8');
async function setup(t) {
  const f = await categoryFixture(); t.after(f.close);
  await f.db.exec(recovery); await f.db.exec(upgrade);
  await f.db.exec("INSERT INTO users(id,name,email,password,role,status) VALUES(1,'Owner','owner@example.invalid','fixture','student','active'); INSERT INTO lost_items(id,item_id,description,location_lost,status,reporter_id) VALUES(10,'L10','Blue bag','Library','potential_match',1); INSERT INTO found_items(id,item_id,description,location_found,status) VALUES(20,'F20','Blue bag','Library','potential_match'),(21,'F21','Other bag','Library','potential_match'); INSERT INTO activity_logs(action,details) VALUES('match','{\"lost_item_id\":10,\"found_item_id\":20}'); INSERT INTO matches(lost_item_id,found_item_id,status) VALUES(10,20,'potential_match');");
  return f;
}
const cancel = (db,lost=10,found=20,actor=7) => db.query('SELECT cancel_potential_match($1,$2,$3) AS result',[lost,found,actor]);

test('cancelling a potential match returns both reports to active, preserves history, and is safe to retry or match again',async t=>{
  const f=await setup(t);
  const first=(await cancel(f.db)).rows[0].result;
  assert.equal(first.success,true);assert.equal(first.already_cancelled,false);
  const second=(await cancel(f.db)).rows[0].result;
  assert.equal(second.already_cancelled,true);
  assert.equal((await f.db.query('SELECT status FROM lost_items WHERE id=10')).rows[0].status,'active');
  assert.equal((await f.db.query('SELECT status FROM found_items WHERE id=20')).rows[0].status,'active');
  assert.equal((await f.db.query('SELECT status FROM matches')).rows[0].status,'cancelled');
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM activity_logs WHERE action='match'")).rows[0].n,1);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM activity_logs WHERE action='unmatch'")).rows[0].n,1);
  assert.equal((await f.db.query("SELECT user_name FROM activity_logs WHERE action='unmatch'")).rows[0].user_name,'Admin');
  assert.equal(await loadSavedPotentialMatch(f.writer,10,'lost_items'),null);
  assert.equal(await loadSavedPotentialMatch(f.writer,20,'found_items'),null);
  await assert.rejects(f.db.query("SELECT complete_item_recovery(10,20,7,'')"),/not eligible/);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM item_recoveries')).rows[0].n,0);
  await f.db.exec("UPDATE lost_items SET status='potential_match' WHERE id=10; UPDATE found_items SET status='potential_match' WHERE id=20; INSERT INTO activity_logs(action,details) VALUES('match','{\"lost_item_id\":10,\"found_item_id\":20}');");
  assert.equal((await loadSavedPotentialMatch(f.writer,10,'lost_items')).found_item.id,20);
  const returned=(await f.db.query("SELECT complete_item_recovery(10,20,7,'Checked ID and answers') AS result")).rows[0].result;
  assert.equal(returned.found_item_id,20);
  await assert.rejects(cancel(f.db),/completed|unavailable/);
});

test('wrong pairs, missing links, returned reports and non-admin accounts cannot cancel a match; failures roll back both reports',async t=>{
  const f=await setup(t);
  await assert.rejects(cancel(f.db,10,20,1),/administrator/);
  await assert.rejects(cancel(f.db,10,21),/saved match changed/);
  await f.db.exec("UPDATE users SET status='suspended' WHERE id=7");
  await assert.rejects(cancel(f.db),/administrator/);
  await f.db.exec("UPDATE users SET status='active' WHERE id=7; DELETE FROM activity_logs; DELETE FROM matches");
  await assert.rejects(cancel(f.db),/No saved potential match/);
  await f.db.exec("INSERT INTO activity_logs(action,details) VALUES('match','{\"lost_item_id\":10,\"found_item_id\":20}'); CREATE FUNCTION fail_unmatch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated update failure'; END $$; CREATE TRIGGER fail_unmatch BEFORE UPDATE ON found_items FOR EACH ROW EXECUTE FUNCTION fail_unmatch();");
  await assert.rejects(cancel(f.db),/isolated update failure/);
  assert.equal((await f.db.query('SELECT status FROM lost_items WHERE id=10')).rows[0].status,'potential_match');
  assert.equal((await f.db.query('SELECT status FROM found_items WHERE id=20')).rows[0].status,'potential_match');
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM activity_logs WHERE action='unmatch'")).rows[0].n,0);
  for(const role of ['anon','authenticated']){
    await assert.rejects(f.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);await tx.query('SELECT cancel_potential_match(10,20,7)');}),/permission denied/);
  }
});

test('cancel API derives the administrator from the session and uses one atomic operation for either report view',async t=>{
  const f=await setup(t), calls=[], secret='isolated-unmatch-http';
  const client={from:f.writer.from,rpc:async(name,params)=>{
    calls.push({name,params});
    try{return{data:(await cancel(f.db,params.p_lost_id,params.p_found_id,params.p_admin_id)).rows[0].result,error:null};}
    catch(error){return{data:null,error};}
  }};
  const app=express();app.use(express.json());app.use('/',createActivityLogsRouter({client,jwtSecret:secret}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const call=(body,token=jwt.sign({id:7,role:'admin'},secret))=>fetch('http://127.0.0.1:'+server.address().port+'/unmatch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  assert.equal((await call({lost_item_id:10,found_item_id:20},'bad')).status,401);
  assert.equal((await call({lost_item_id:10,found_item_id:''})).status,400);
  assert.equal(calls.length,0);
  const response=await call({lost_item_id:10,found_item_id:'20',admin_id:1});
  assert.equal(response.status,200);assert.equal((await response.json()).success,true);
  assert.deepEqual(calls,[{name:'cancel_potential_match',params:{p_lost_id:10,p_found_id:20,p_admin_id:7}}]);
  assert.equal((await call({lost_item_id:10,found_item_id:20})).status,200);
  assert.equal(await loadSavedPotentialMatch(f.writer,10,'lost_items'),null);
});
