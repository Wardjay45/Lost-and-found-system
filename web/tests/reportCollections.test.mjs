import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReportCollection, loadReportCollection } from '../src/services/reportCollections.mjs';
function api(lost, found) {
 const requests=[];
 return { requests, lostItemsApi:{getAll:async params=>{requests.push(['lost',params]);return lost;}},foundItemsApi:{getAll:async params=>{requests.push(['found',params]);return found;}} };
}
test('potential collection queries both sources and excludes active, claimed and cancelled reports',async()=>{
 const source=api([{id:1,status:'potential_match',date_reported:'2026-10-01',description:'Bag'},{id:2,status:'claimed'},{id:3,status:'active'}],[{id:1,status:'potential_match',date_found:'2026-10-02',finder_name:'Finder'},{id:4,status:'cancelled'}]);
 const rows=await loadReportCollection('potential',source);
 assert.deepEqual(source.requests,[['lost',{status:'potential_match'}],['found',{status:'potential_match'}]]);
 assert.deepEqual(rows.map(row=>row.collectionKey),['found:1','lost:1']);
 assert.equal(rows[0].reportedBy,'Finder');assert.equal(rows[0].reportDate,'2026-10-02');
});
test('claimed collection requires actual claimed status and never promotes a potential match or resolved report',async()=>{
 const source=api([{id:1,status:'claimed',date_reported:'2026-10-01',resolved_date:'2026-10-03'},{id:2,status:'potential_match'},{id:3,status:'resolved'}],[{id:4,status:'claimed',date_found:'2026-10-01',resolved_date:'2026-10-04'}]);
 const rows=await loadReportCollection('claimed',source);
 assert.deepEqual(rows.map(row=>row.collectionKey),['found:4','lost:1']);
 assert.ok(source.requests.every(([,params])=>params.status==='claimed'));
});
test('search and report-type filters cover numeric IDs, person, location and description without mutating reports',async()=>{
 const rows=await loadReportCollection('potential',api([{id:7,item_id:'L-7',description:'Blue bag',status:'potential_match',reporter_name:'Owner',location_lost:'Library',date_reported:'2026-10-01'}],[{id:7,item_id:'F-7',description:'Keys',status:'potential_match',finder_name:'Finder',location_found:'Office',date_found:'2026-10-02'}]));
 assert.equal(filterReportCollection(rows,{reportType:'lost'}).length,1);
 for(const search of ['  BLUE  ','Owner','library','7'])assert.ok(filterReportCollection(rows,{search}).length,search);
 assert.equal(filterReportCollection(rows,{reportType:'lost',search:'Finder'}).length,0);
 assert.equal(filterReportCollection(rows,{search:'missing'}).length,0);assert.equal(rows.length,2);
});
test('a failed or malformed source never becomes a successful partial collection',async()=>{
 const source=api([],[]);source.foundItemsApi.getAll=async()=>{throw Error('offline');};
 await assert.rejects(loadReportCollection('claimed',source),/offline/);
 await assert.rejects(loadReportCollection('potential',api([],{})),/complete item reports/);
 await assert.rejects(loadReportCollection('other',api([],[])),/Unknown report collection/);
});
