import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { categoryFixture } from './helpers/categoriesFixture.mjs';
import { installReportCancellation } from './helpers/reportCancellationFixture.mjs';
import { createUsersRouter } from '../routes/users.js';
import { createMobileDataRouter } from '../routes/mobileData.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { auditMutations } from '../services/audit.js';

test('private database tables deny anonymous access and conversation migration is repeatable without losing history', async t => {
  const f = await categoryFixture(); t.after(f.close);
  await f.db.exec(readFileSync(new URL('../add-recovery-feedback.sql', import.meta.url), 'utf8'));
  await f.db.exec("INSERT INTO users(id,name,email,password,role,status) VALUES (1,'Campus One','one@example.invalid','fixture','student','active'); INSERT INTO conversations(name) VALUES ('Campus One');");
  const sql = readFileSync(new URL('../secure-data-access.sql', import.meta.url), 'utf8');
  await f.db.exec(sql); await f.db.exec(sql);
  assert.equal((await f.db.query('SELECT user_id FROM conversations')).rows[0].user_id, 1);
  for (const role of ['anon','authenticated']) {
    for (const table of ['users','lost_items','found_items','matches','messages','conversations','activity_logs']) {
      await assert.rejects(f.db.transaction(async tx => { await tx.exec('SET LOCAL ROLE ' + role); await tx.query('SELECT * FROM ' + table); }), /permission denied/);
    }
    await f.db.transaction(async tx => { await tx.exec('SET LOCAL ROLE ' + role); await tx.query('SELECT * FROM categories'); await tx.query('SELECT * FROM qr_locations'); });
    await assert.rejects(f.db.transaction(async tx => { await tx.exec('SET LOCAL ROLE ' + role); await tx.query("INSERT INTO categories(name) VALUES ('Unauthorized')"); }), /permission denied/);
  }
  assert.equal((await f.db.query('SELECT count(*)::int AS count FROM conversations')).rows[0].count, 1);
});

test('authenticated account and mobile APIs enforce roles, ownership and server-derived identity against real isolated Postgres', async t => {
  const f = await categoryFixture();
  const sql = readFileSync(new URL('../secure-data-access.sql', import.meta.url), 'utf8');
  await f.db.exec(sql);
  await f.db.exec("INSERT INTO users(id,name,email,password,role,status) VALUES (1,'Campus One','one@example.invalid','fixture','student','active'),(2,'Campus Two','two@example.invalid','fixture','student','active'),(8,'Superadmin','super@example.invalid','fixture','superadmin','active'); INSERT INTO categories(id,name,icon) VALUES (10,'Bags','bag'); INSERT INTO qr_locations(id,name,is_active) VALUES (10,'Library',true); INSERT INTO lost_items(id,item_id,description,location_lost,reporter_id,status) VALUES (101,'L-OWN','Own report','Library',1,'active'),(102,'L-OTHER','Private report','Library',2,'active'); INSERT INTO found_items(id,item_id,description,location_found,finder_id,finder_name,status) VALUES (201,'F-PUBLIC','Public found item','Library',2,'Private reporter','active'),(202,'F-PRIVATE','Returned item','Library',2,'Private reporter','claimed');");
  await installReportCancellation(f);
  const secret = 'isolated-web-fixes-session';
  const app = express(); app.use(express.json());
  app.use('/api', createProductionAccess(f.writer, { jwtSecret: secret }), auditMutations(f.writer));
  app.use('/api/users', createUsersRouter({ client: f.writer, jwtSecret: secret }));
  app.use('/api/mobile/data', createMobileDataRouter({ client: f.writer, jwtSecret: secret }));
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await f.close(); });
  const token = (id,role) => jwt.sign({id,role},secret);
  const sessions = { user: token(1,'student'), other:token(2,'student'), admin:token(7,'admin'), super:token(8,'superadmin') };
  const call = (path,method='GET',body,session=sessions.user) => fetch('http://127.0.0.1:'+server.address().port+'/api'+path,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await call('/users','GET',undefined,'')).status,401);
  assert.equal((await call('/users')).status,403);
  assert.equal((await call('/lost-items')).status,403);
  const profile=await (await call('/mobile/data/users?select=id,name,role')).json();
  assert.deepEqual(profile,[{id:1,name:'Campus One',role:'student'}]);
  assert.equal((await call('/mobile/data/users?select=password')).status,400);
  assert.deepEqual(await (await call('/mobile/data/lost_items?id=eq.102')).json(),[]);
  const publicFound=await (await call('/mobile/data/found_items?id=eq.201')).json();
  assert.equal(publicFound.length,1); assert.equal('finder_name' in publicFound[0],false);
  assert.deepEqual(await (await call('/mobile/data/found_items?id=eq.202')).json(),[]);
  assert.equal((await call('/mobile/data/users?id=eq.1','PATCH',{role:'admin'})).status,400);
  assert.equal((await call('/mobile/data/users?id=eq.2','PATCH',{phone:'wrong'})).status,403);
  const avatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAMAAwDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCaAsif/9k=';
  assert.equal((await call('/mobile/data/users?id=eq.2','PATCH',{avatar})).status,403);
  for (const invalid of ['https://example.invalid/image.jpg', 'data:image/jpeg;base64,/9j/AA==', null]) {
    assert.equal((await call('/mobile/data/users?id=eq.1','PATCH',{avatar:invalid})).status,400);
  }
  const image = Buffer.from(avatar.split(',')[1], 'base64');
  const oversized = Buffer.from(image);
  const frame = oversized.indexOf(Buffer.from([0xff, 0xc0]));
  oversized.writeUInt16BE(257, frame + 7);
  assert.equal((await call('/mobile/data/users?id=eq.1','PATCH',{avatar:'data:image/jpeg;base64,' + oversized.toString('base64')})).status,400);
  const updatedPhoto = await call('/mobile/data/users?id=eq.1&select=id,avatar','PATCH',{avatar});
  assert.equal(updatedPhoto.status,200);
  assert.deepEqual(await updatedPhoto.json(), [{id:1,avatar}]);
  assert.equal((await (await call('/users/1','GET',undefined,sessions.admin)).json()).avatar,avatar);
  const directory = await (await call('/users','GET',undefined,sessions.admin)).json();
  assert.equal(directory.find(user => user.id === 1).avatar,avatar);
  assert.equal((await call('/mobile/data/users?id=eq.1','PATCH',{avatar:''})).status,200);
  assert.equal((await (await call('/users/1','GET',undefined,sessions.admin)).json()).avatar,'');
  const reportResponse=await call('/mobile/data/lost_items','POST',{description:'New own bag',category_id:10,location_lost:'Library',reporter_id:2,reporter_name:'Forged',status:'claimed'});
  assert.equal(reportResponse.status,201); const report=(await reportResponse.json())[0];
  assert.equal(report.reporter_id,1);assert.equal(report.reporter_name,'Campus One');assert.equal(report.status,'active');
  assert.equal((await call('/mobile/data/lost_items?id=eq.101','PATCH',{status:'claimed'})).status,403);
  assert.equal((await call('/mobile/data/lost_items?id=eq.102','PATCH',{status:'cancelled',cancel_reason:'Not mine'})).status,404);
  const cancelled = await call('/mobile/data/lost_items?id=eq.101','PATCH',{status:'cancelled',cancel_reason:'Duplicate report'});
  assert.equal(cancelled.status,200);
  assert.equal('cancellation_actor' in (await cancelled.json())[0], false);
  const { rows: [record] } = await f.db.query('SELECT cancellation_actor FROM lost_items WHERE id = 101');
  assert.equal(record.cancellation_actor.id, 1);
  assert.equal(record.cancellation_actor.role, 'student');
  const { rows: [event] } = await f.db.query("SELECT user_name,role FROM activity_logs WHERE action = 'cancel'");
  assert.deepEqual(event, { user_name: 'Campus One', role: 'student' });
  const actorPath = '/mobile/data/lost_items?id=eq.101&select=cancellation_actor';
  assert.deepEqual(await (await call(actorPath)).json(), [{ cancellation_actor: { name: 'Campus One', role: 'student' } }]);
  assert.equal((await call(actorPath, 'GET', undefined, sessions.other)).status, 404);
  assert.equal((await call('/mobile/data/lost_items?select=cancellation_actor')).status, 400);
  assert.equal((await call('/mobile/data/activity_logs')).status, 404);
  await f.db.exec(`INSERT INTO found_items
    (id,item_id,description,location_found,finder_id,status,cancel_reason,last_updated)
    VALUES (203,'FOUND-LEGACY','Water bottle','Library',1,'cancelled','Duplicate, already filed.','2026-11-09T12:00:00'),
           (204,'FOUND-UNKNOWN','Umbrella','Library',1,'cancelled','Older report','2026-11-09T12:00:00');
    INSERT INTO activity_logs (action,details,user_name,role,timestamp)
    VALUES ('cancel','Found report #203 cancelled (status: cancelled) Reason: Duplicate, already filed..','Staff at the time','superadmin','2026-11-09T12:00:01');
    ALTER TABLE found_items DROP COLUMN cancellation_actor;`);
  const legacyPath = '/mobile/data/found_items?id=eq.203&select=cancellation_actor';
  assert.deepEqual(await (await call(legacyPath)).json(), [{ cancellation_actor: { name: 'Staff at the time', role: 'superadmin' } }]);
  assert.deepEqual(await (await call('/mobile/data/found_items?id=eq.204&select=cancellation_actor')).json(), [{ cancellation_actor: null }]);
  f.fault.table = 'activity_logs'; f.fault.action = 'select';
  assert.equal((await call(legacyPath)).status, 503);
  f.fault.table = null; f.fault.action = null;
  const ownConversationResponse=await call('/mobile/data/conversations','POST',{name:'Campus Two'});
  assert.equal(ownConversationResponse.status,201); const own=(await ownConversationResponse.json())[0];
  assert.equal(own.name,'Campus One');assert.equal(own.user_id,1);
  const otherConversation=await (await call('/mobile/data/conversations','POST',{},sessions.other)).json();
  assert.notEqual(own.id,otherConversation[0].id);
  await f.db.exec("INSERT INTO users(id,name,email,password,role,status) VALUES(3,'Campus Two','three@example.invalid','fixture','student','active')");
  const sameName = await call('/mobile/data/conversations','POST',{},token(3,'student'));
  assert.equal(sameName.status,201);
  const separate = (await sameName.json())[0];
  assert.equal(separate.user_id,3);assert.notEqual(separate.id,otherConversation[0].id);
  assert.equal((await call('/mobile/data/messages','POST',{conversation_id:otherConversation[0].id,text:'Wrong chat'})).status,403);
  const message=await (await call('/mobile/data/messages','POST',{conversation_id:own.id,text:'Hello office',sender:'admin'})).json();
  assert.equal(message[0].sender,'user');
  assert.deepEqual(await (await call('/mobile/data/messages?conversation_id=eq.'+otherConversation[0].id)).json(),[]);
  for (const session of [sessions.admin, sessions.super]) {
    for (const role of ['admin', 'student', 'superadmin']) {
      const response = await call('/users/2/role','PUT',{role},session);
      assert.equal(response.status,405);
      assert.match((await response.json()).error,/roles are fixed/i);
    }
    assert.equal((await call('/users/2','PUT',{role:'admin',name:'Role injection'},session)).status,400);
  }
  assert.equal((await call('/users/7/status','PUT',{status:'archived'},sessions.admin)).status,403);
  assert.equal((await call('/users/8/status','PUT',{status:'archived'},sessions.super)).status,403);
  assert.equal((await call('/users/7/status','PUT',{status:'archived'},sessions.super)).status,403);
  assert.equal((await call('/users/8/status','PUT',{status:'archived'},sessions.admin)).status,403);
  assert.deepEqual((await f.db.query('SELECT name,role,status FROM users WHERE id=2')).rows,[{name:'Campus Two',role:'student',status:'active'}]);
  assert.equal((await call('/mobile/data/users','GET',undefined,sessions.other)).status,200,'Blocked role changes must preserve the campus account and its session');
  const logged=(await f.db.query("SELECT user_name,details FROM activity_logs WHERE details LIKE '%role: admin%'")).rows;
  assert.equal(logged.length,0,'Rejected role changes must not record a successful promotion');
  for (const session of [sessions.admin, sessions.super]) {
    assert.equal((await call('/users/2/status','PUT',{status:'archived'},session)).status,200);
    assert.equal((await call('/mobile/data/users','GET',undefined,sessions.other)).status,403);
    assert.equal((await call('/users/2/status','PUT',{status:'active'},session)).status,200);
    assert.equal((await call('/mobile/data/users','GET',undefined,sessions.other)).status,200);
  }
  assert.equal((await call('/users/1/status','PUT',{status:'suspended'},sessions.admin)).status,200);
  assert.equal((await call('/mobile/data/users')).status,403);
});
