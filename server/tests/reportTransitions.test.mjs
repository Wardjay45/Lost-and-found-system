import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import { categoryFixture } from './helpers/categoriesFixture.mjs';
import { createProductionAccess } from '../services/productionAccess.js';
import { auditMutations } from '../services/audit.js';
import { createDashboardRouter } from '../routes/dashboard.js';

test('generic report routes cannot fabricate a recovery, undo a saved match, or overwrite a concurrent handover', async t => {
  const f=await categoryFixture();
  await f.db.exec("INSERT INTO lost_items(id,item_id,description,location_lost,status) VALUES (101,'L-MATCH','Bag','Library','potential_match'),(102,'L-ACTIVE','Bag','Library','active'); INSERT INTO found_items(id,item_id,description,location_found,status) VALUES (201,'F-PENDING','Bag','Library','pending'),(202,'F-RETURNED','Bag','Library','claimed');");
  const require=createRequire(import.meta.url), secret='isolated-report-transition-test';
  const app=express();app.use(express.json());app.use(createProductionAccess(f.writer,{jwtSecret:secret}),auditMutations(f.writer));
  for(const kind of ['lost','found']){
    const key='transition_'+kind;globalThis[key]=f.writer;
    const sourceUrl=new URL('../routes/'+kind+'Items.js',import.meta.url);
    const source=readFileSync(sourceUrl,'utf8').replace(/from '([^']+)'/g,(_match,specifier)=>{
      const resolved=specifier==='../db.js'?'data:text/javascript,export default globalThis['+JSON.stringify(key)+']':specifier.startsWith('.')?new URL(specifier,sourceUrl).href:pathToFileURL(require.resolve(specifier)).href;
      return 'from '+JSON.stringify(resolved);
    });
    const router=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
    app.use('/'+kind+'-items',router);
  }
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));delete globalThis.transition_lost;delete globalThis.transition_found;await f.close();});
  const token=jwt.sign({id:7,role:'admin'},secret);
  const call=(path,body)=>fetch('http://127.0.0.1:'+server.address().port+path,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  for(const status of ['claimed','resolved','potential_match','matched','invented']){
    assert.equal((await call('/lost-items/102/status',{status})).status,400,status);
    assert.equal((await call('/found-items/201/status',{status})).status,400,status);
  }
  assert.equal((await call('/lost-items/102',{status:'claimed'})).status,400);
  assert.equal((await call('/found-items/201',{status:'claimed'})).status,400);
  assert.equal((await call('/lost-items/101/status',{status:'cancelled',cancel_reason:'Wrong pairing'})).status,409);
  assert.equal((await call('/found-items/202/status',{status:'active'})).status,409);
  assert.equal((await call('/lost-items/102/status',{status:'cancelled'})).status,400);
  assert.equal((await call('/lost-items/102/status',{status:'cancelled',cancel_reason:'Duplicate report'})).status,200);
  assert.equal((await call('/found-items/201/status',{status:'active'})).status,200);
  const logs=(await f.db.query('SELECT action,user_name,details FROM activity_logs ORDER BY id')).rows;
  assert.equal(logs.length,2);assert.equal(logs[0].user_name,'Admin');
  assert.match(logs[0].details,/Duplicate report/);assert.equal(logs[0].action,'cancel');assert.equal(logs[1].action,'approve');
  assert.equal((await f.db.query('SELECT status FROM lost_items WHERE id=101')).rows[0].status,'potential_match');
  assert.equal((await f.db.query('SELECT status FROM found_items WHERE id=202')).rows[0].status,'claimed');
});

test('Overview counts verified handovers separately and fails visibly on unavailable database results', async t=>{
  let broken=false;
  const client={from(table){
    let status,head=false;
    const q={select(_columns,options){head=!!options?.head;return q;},eq(_key,value){status=value;return q;},order(){return q;},limit(){return q;},then(resolve,reject){
      const counts={lost_items:9,found_items:8,users:3,categories:2,matches:20,item_recoveries:2};
      const count=status==='potential_match'?4:status==='claimed'?3:status==='pending'?1:counts[table]||0;
      return Promise.resolve({data:head?null:[],count,error:broken?Error('isolated failure'):null}).then(resolve,reject);
    }};return q;
  }};
  const app=express();app.use('/',createDashboardRouter({client}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const url='http://127.0.0.1:'+server.address().port+'/stats';
  const response=await fetch(url);assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.totalVerifiedRecoveries,2);assert.equal(body.totalPotentialMatches,4);assert.equal(body.foundPending,1);
  broken=true;assert.equal((await fetch(url)).status,500);
});
