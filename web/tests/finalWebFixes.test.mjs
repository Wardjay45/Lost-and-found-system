import test from 'node:test';
import assert from 'node:assert/strict';
import { unclaimedReports } from '../../shared/unclaimed.mjs';
import { formatDateTime, formatTime } from '../src/utils/formatters.js';
import { sendMatchNotification } from '../src/services/matchNotification.mjs';

test('Unclaimed shows only old active reports and never returned, pending, matched or cancelled records', () => {
  const old = '2025-01-01T12:00:00', now = Date.parse('2026-11-03T12:00:00Z');
  const rows = ['active','claimed','resolved','cancelled','pending','potential_match'].map((status,id) => ({id,status,date_found:old}));
  rows.push({id:99,status:'active',date_found:'2026-11-02T00:00:00'}, {id:100,status:'active',date_found:'invalid'});
  assert.deepEqual(unclaimedReports(rows,60,now).map(row=>row.id),[0]);
  assert.deepEqual(rows.map(row=>row.status),['active','claimed','resolved','cancelled','pending','potential_match','active','active']);
});

test('report and chat formatters interpret stored UTC in Philippine time and handle absent dates', () => {
  assert.match(formatTime('2026-11-03T05:30:00'),/01:30\s*pm/i);
  assert.equal(formatDateTime('2026-11-03T05:30:00'),formatDateTime('2026-11-03T13:30:00+08:00'));
  assert.equal(formatTime('bad'),'');assert.equal(formatDateTime(null),'N/A');
});

test('a recorded match and notification delivery have separate outcomes; repeated placeholders render and recipient IDs are used', async () => {
  const match={score:.96,lost_item:{reporter_id:12,reporter_name:'Campus User',description:'Blue bag'}};
  let sent;
  const delivered=await sendMatchNotification(match,{apiUrl:'/api',reporterName:'Campus User',template:'Hi {userName} {userName}: {itemDescription} ({similarity}%)',fetcher:async(url,options)=>{sent={url,body:JSON.parse(options.body)};return{ok:true};}});
  assert.equal(delivered.delivered,true);assert.equal(sent.body.recipient_id,12);assert.equal(sent.body.sender_name,undefined);
  assert.equal(sent.body.text,'Hi Campus User Campus User: Blue bag (96%)');
  const failed=await sendMatchNotification(match,{apiUrl:'/api',fetcher:async()=>({ok:false,status:503})});
  assert.equal(failed.delivered,false);assert.match(failed.warning,/Potential match saved/);
  const missing=await sendMatchNotification({...match,lost_item:{}},{fetcher:()=>{throw Error('Must not call network');}});
  assert.equal(missing.delivered,false);assert.match(missing.warning,/no linked reporter account/);
});
