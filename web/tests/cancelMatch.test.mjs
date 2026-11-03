import test from 'node:test';
import assert from 'node:assert/strict';
import { latestPairEvent, findRecordedPair } from '../../shared/potentialMatches.mjs';
import { activityView } from '../../shared/activityLogs.mjs';

test('cancelled associations stay cancelled across timezone formats until a newer match is recorded',()=>{
  const pair={lost_item_id:10,found_item_id:20};
  const logs=[
    {id:1,action:'match',timestamp:'2026-11-03T05:00:00Z',details:JSON.stringify(pair)},
    {id:2,action:'unmatch',timestamp:'2026-11-03T05:10:00',details:JSON.stringify({...pair,text:'Potential match cancelled.'})},
  ];
  for(const [id,table] of [[10,'lost_items'],[20,'found_items']]){
    assert.equal(findRecordedPair(logs,id,table),null);
    assert.equal(latestPairEvent(logs,id,table).log.action,'unmatch');
  }
  assert.equal(activityView(logs[1]).label,'Potential match cancelled');
  logs.push({id:3,action:'match',timestamp:'2026-11-03T05:20:00Z',details:pair});
  assert.equal(findRecordedPair(logs,10,'lost_items').foundId,'20');
});
