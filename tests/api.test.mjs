import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
const {loadScope,loadTaskPage}=await import('../lib/api.ts');

test('garden loads active plots and server-side discoveries without loading history',async()=>{
 const original=globalThis.fetch,requests=[];
 globalThis.fetch=async(input)=>{
  const url=new URL(typeof input==='string'?input:input.url);requests.push(url);
  const body=url.pathname.endsWith('/garden_discovered_seeds')?['carrot','rice','tomato']:[];
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const result=await loadScope('garden','00000000-0000-0000-0000-000000000001',new AbortController().signal);
  assert.deepEqual(result.discoveredSeeds,['carrot','rice','tomato']);assert.equal(requests.length,3);
  const plots=requests.find(url=>url.pathname.endsWith('/garden_plots'));
  assert.equal(plots.searchParams.get('harvested'),'eq.false');
  assert.ok(requests.some(url=>url.pathname.endsWith('/garden_unlocked_slots')));
 }finally{globalThis.fetch=original}
});

test('tasks use cursor, open filter and request only progress for the visible page',async()=>{
 const original=globalThis.fetch,requests=[];
 const task={id:'00000000-0000-0000-0000-000000000010',created_at:'2026-01-01T00:00:00Z',title:'test',status:'published',files:[]};
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url);requests.push({url,init});
  return new Response(JSON.stringify(url.pathname.endsWith('/garden_task_page')?[task]:[]),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const cursor={at:'2026-02-01T00:00:00Z',id:'00000000-0000-0000-0000-000000000099'};
  const result=await loadTaskPage('00000000-0000-0000-0000-000000000001',false,true,cursor,new AbortController().signal);
  assert.equal(result.items.length,1);assert.equal(requests.length,2);
  const args=JSON.parse(requests[0].init.body);assert.equal(args.p_open,true);assert.equal(args.p_limit,51);assert.equal(args.p_before_id,cursor.id);
  assert.match(requests[1].url.searchParams.get('task_id'),/00000000-0000-0000-0000-000000000010/);
 }finally{globalThis.fetch=original}
});
