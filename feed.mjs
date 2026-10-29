#!/usr/bin/env node
// Node 20+, no packages. Fixed free endpoint; never signs or pays.
import {pathToFileURL} from 'node:url';
const ENDPOINT='https://agent-bounty-feed.dailydollar.workers.dev/mcp';
const TOOLS=new Set(['list_bounties','get_bounty','get_feed_stats','get_new_bounties']);

export function decode(text, type, id) {
  const messages=type.includes('text/event-stream')
    ? text.split(/\r?\n\r?\n/).flatMap(block=>{
      const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
      return data ? [JSON.parse(data)] : [];
    }) : [JSON.parse(text)];
  const m=messages.find(x=>x.jsonrpc==='2.0' && x.id===id);
  if(!m)throw Error('Missing matching JSON-RPC response');
  if(m.error)throw Error(`MCP error ${m.error.code}: ${m.error.message}`);
  if(!Object.hasOwn(m,'result'))throw Error('Missing result');
  return m.result;
}

export class Feed {
  constructor(request=fetch){this.request=request;this.id=0;this.session=null;this.version='2025-03-26';}
  async rpc(method,params,notification=false){
    const id=notification?undefined:++this.id;
    const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':this.version};
    if(this.session)headers['Mcp-Session-Id']=this.session;
    const r=await this.request(ENDPOINT,{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(20000),body:JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,params})});
    if(r.status===402){await r.body?.cancel();throw Error('Payment requested: stopped without paying.');}
    if(!r.ok){await r.body?.cancel();throw Error(`HTTP ${r.status}`);}
    if(method==='initialize')this.session=r.headers.get('mcp-session-id');
    if(notification){await r.body?.cancel();return;}
    const type=r.headers.get('content-type')||'';
    if(!type.includes('application/json')&&!type.includes('text/event-stream')){await r.body?.cancel();throw Error('Unexpected response format');}
    // Finite JSON or finite SSE response only; timeout bounds a hanging stream.
    const reader=r.body.getReader();let total=0;const chunks=[];
    try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2_000_000)throw Error('Response exceeds 2 MB');chunks.push(value);}}
    finally{await reader.cancel();}
    return decode(Buffer.concat(chunks).toString('utf8'),type,id);
  }
  async initialize(){
    const r=await this.rpc('initialize',{protocolVersion:this.version,capabilities:{},clientInfo:{name:'agent-feed-readonly-demo',version:'1.0.0'}});
    if(r.protocolVersion!==this.version)throw Error(`Unsupported protocol version: ${r.protocolVersion}`);
    await this.rpc('notifications/initialized',{},true);
  }
  async call(name,args){
    if(!TOOLS.has(name))throw Error('Tool not in the read-only allowlist');
    const r=await this.rpc('tools/call',{name,arguments:args});
    if(r.isError)throw Error('Tool reported failure: '+JSON.stringify(r.content));
    if(r.structuredContent)return r.structuredContent;
    const text=(r.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
    try{return JSON.parse(text);}catch{return {text};}
  }
}

export async function main(argv){
  if(!argv.length||argv[0]==='--help'){
    console.log('node feed.mjs list [JSON filters]\nnode feed.mjs stats\nnode feed.mjs get ID\nnode feed.mjs new ISO_TIMESTAMP [AFTER_ID]\nOutput is unverified discovery data, not a payment or acceptance guarantee.');return;
  }
  const [command,arg,after]=argv;
  let name,args;
  if(command==='list'){name='list_bounties';args={limit:5,exclude_requires:'kyc,stake,bond,purchase,human_only',...(arg?JSON.parse(arg):{})};if(!Number.isInteger(args.limit)||args.limit<1||args.limit>100)throw Error('limit must be 1..100');}
  else if(command==='stats'){name='get_feed_stats';args={};}
  else if(command==='get'&&arg){name='get_bounty';args={id:arg};}
  else if(command==='new'&&arg){if(!Number.isFinite(Date.parse(arg)))throw Error('Use an ISO timestamp');name='get_new_bounties';args={since:arg,...(after?{after_id:after}:{}),limit:20};}
  else throw Error('Unknown command or missing argument; use --help');
  const client=new Feed();await client.initialize();console.log(JSON.stringify(await client.call(name,args),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
