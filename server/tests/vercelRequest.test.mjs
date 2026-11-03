import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createVercelHandler} from '../services/vercelRequest.js';

test('Vercel catch-all routing metadata is removed before Express parses strict mobile filters',async t=>{
 const app=express();app.get('/api/mobile/data/users',(req,res)=>res.json({query:req.query,path:req.path}));
 const handler=createVercelHandler(app);
 const server=(await import('node:http')).createServer((req,res)=>{req.query={path:'mobile/data/users',select:'id',limit:'1',other:'retained'};handler(req,res);});
 server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/mobile/data/users?path=mobile%2Fdata%2Fusers&select=id&limit=1&other=retained');
 const data=await response.json();assert.equal(data.path,'/api/mobile/data/users');assert.deepEqual(data.query,{select:'id',limit:'1',other:'retained'});
});
test('ordinary query parameters and repeated values are preserved without injecting a query object',()=>{
 const req={url:'/api/mobile/data/lost_items?path=mobile/data/lost_items&description=eq.Blue%20bag&tag=a&tag=b'};
 createVercelHandler((request)=>{const url=new URL(request.url,'https://test.invalid');assert.equal(url.searchParams.has('path'),false);assert.equal(url.searchParams.get('description'),'eq.Blue bag');assert.deepEqual(url.searchParams.getAll('tag'),['a','b']);assert.equal(request.query,undefined);})(req,{});
});
