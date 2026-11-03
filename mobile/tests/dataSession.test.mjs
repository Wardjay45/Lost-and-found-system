import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createAuthenticatedDataFetch, setDataSession } from '../src/services/dataSession.mjs';

test('the actual mobile query client sends signed-in table operations only through the API, preserving single and paged response shapes', async () => {
  const requests=[];
  const transport=createAuthenticatedDataFetch({getApiUrl:async()=> 'https://api.example.invalid/api',fetcher:async(url,options)=>{
    requests.push({url,options});
    return new Response(JSON.stringify(options.headers.get('Accept')?.includes('vnd.pgrst.object')?{id:11,description:'Bag'}:[{id:11,description:'Bag'}]),{status:200,headers:{'Content-Type':'application/json'}});
  }});
  const client=createClient('https://db.example.invalid','isolated-anon-key',{global:{fetch:transport}});
  setDataSession('isolated-signed-session');
  const rows=await client.from('lost_items').select('id,description').eq('reporter_id',7).range(0,999);
  assert.deepEqual(rows.data,[{id:11,description:'Bag'}]);
  const single=await client.from('lost_items').insert({description:'Bag'}).select().single();
  assert.equal(single.data.id,11);
  for(const request of requests){
    assert.ok(request.url.startsWith('https://api.example.invalid/api/mobile/data/lost_items?'));
    assert.equal(request.options.headers.get('Authorization'),'Bearer isolated-signed-session');
    assert.equal(request.options.headers.has('apikey'),false);
  }
  setDataSession(null);
  const previous=requests.length;
  const denied=await client.from('users').select('*');
  assert.equal(denied.status,401);assert.equal(requests.length,previous);
});
