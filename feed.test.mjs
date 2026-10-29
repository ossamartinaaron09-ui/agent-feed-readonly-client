import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Feed,decode} from './feed.mjs';
test('finite SSE handles notifications, CRLF and response matching',()=>{
 const s='data: {"jsonrpc":"2.0","method":"ping"}\r\n\r\ndata: {"jsonrpc":"2.0","id":7,\r\ndata: "result":{"ok":true}}\r\n\r\n';
 assert.deepEqual(decode(s,'text/event-stream',7),{ok:true});
});
test('rejects mismatched IDs and server errors',()=>{
 assert.throws(()=>decode('{"jsonrpc":"2.0","id":2,"result":{}}','application/json',3),/matching/);
 assert.throws(()=>decode('{"jsonrpc":"2.0","id":2,"error":{"code":-1,"message":"failure"}}','application/json',2),/failure/);
});
test('402 stops after one request; no payment or retry',async()=>{
 let calls=0;const c=new Feed(async()=>{calls++;return new Response('{}',{status:402});});
 await assert.rejects(c.initialize(),/without paying/);assert.equal(calls,1);
});
test('handshake propagates session; initialized notification has no ID',async()=>{
 const seen=[];const c=new Feed(async(url,o)=>{const b=JSON.parse(o.body);seen.push({url,o,b});
 if(b.method==='initialize')return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{protocolVersion:'2025-03-26'}}),{headers:{'Content-Type':'application/json','Mcp-Session-Id':'test-session'}});
 if(b.method==='notifications/initialized')return new Response(null,{status:202});
 return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'{"items":[]}' }]}}),{headers:{'Content-Type':'application/json'}});});
 await c.initialize();assert.deepEqual(await c.call('list_bounties',{limit:1}),{items:[]});
 assert.equal(seen[1].b.id,undefined);assert.equal(seen[2].o.headers['Mcp-Session-Id'],'test-session');assert.equal(seen[2].o.redirect,'error');
 await assert.rejects(c.call('pay',{}),/allowlist/);assert.equal(seen.length,3);
});
test('oversized responses fail closed',async()=>{
 const c=new Feed(async()=>new Response(' '.repeat(2_000_001),{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(c.rpc('tools/list',{}),/exceeds/);
});
