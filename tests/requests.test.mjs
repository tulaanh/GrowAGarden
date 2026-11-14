import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RequestCoordinator,RetryRequests,mutateAndRefresh} from '../lib/requests.ts';
import {toPage,validateFiles} from '../lib/api.ts';

const deferred=()=>{let resolve;let reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};

test('overlapping refreshes coalesce and invalidated requests cannot commit',async()=>{
 const coordinator=new RequestCoordinator(),first=deferred(),second=deferred(),commits=[];
 const old=coordinator.run('garden',()=>first.promise,value=>commits.push(value));
 const duplicate=coordinator.run('garden',()=>{throw Error('duplicate load')},value=>commits.push(value));
 assert.equal(old,duplicate);
 coordinator.invalidate('garden');
 const current=coordinator.run('garden',()=>second.promise,value=>commits.push(value));
 second.resolve('new');await current;first.resolve('old');await old;
 assert.deepEqual(commits,['new']);
});

test('session reset discards even a request that ignores abort',async()=>{
 const coordinator=new RequestCoordinator(),pending=deferred(),commits=[];
 const old=coordinator.run('garden',()=>pending.promise,value=>commits.push(value));
 coordinator.reset();pending.resolve('old user');await old;
 assert.deepEqual(commits,[]);
});

test('a saved mutation is distinguished from a failed refresh',async()=>{
 let saved=0;
 const result=await mutateAndRefresh(async()=>{saved++},async()=>{throw Error('offline')});
 assert.equal(saved,1);assert.equal(result.saved,true);assert.equal(result.syncError.message,'offline');
 await assert.rejects(mutateAndRefresh(async()=>{throw Error('failed')},async()=>{throw Error('must not refresh')}),/failed/);
});

test('retry uses the same request until confirmed and creates a new one afterwards',async()=>{
 const retry=new RetryRequests(),ids=[];
 await assert.rejects(retry.run('purchase',async id=>{ids.push(id);throw Error('network')}));
 await retry.run('purchase',async id=>{ids.push(id)});
 await retry.run('purchase',async id=>{ids.push(id)});
 assert.equal(ids[0],ids[1]);assert.notEqual(ids[1],ids[2]);
});

test('pagination keeps all 50 rows and a stable next cursor',()=>{
 const rows=Array.from({length:51},(_,i)=>({id:String(i),created_at:'same'}));
 const page=toPage(rows,row=>row.created_at);
 assert.equal(page.items.length,50);assert.deepEqual(page.next,{id:'49',at:'same'});
 assert.equal(toPage(rows.slice(0,50),row=>row.created_at).next,null);
});

test('file validation rejects the entire batch before upload',()=>{
 const file=(type,size)=>({type,size});
 assert.doesNotThrow(()=>validateFiles([file('image/png',10)],'garden-homework'));
 assert.throws(()=>validateFiles([file('image/png',10),file('text/plain',10)],'garden-homework'));
 assert.throws(()=>validateFiles([file('image/png',0)],'garden-homework'));
 assert.doesNotThrow(()=>validateFiles(Array(10).fill(file('image/png',10)),'garden-homework'));
 assert.throws(()=>validateFiles(Array(11).fill(file('image/png',10)),'garden-homework'));
 assert.throws(()=>validateFiles(Array(6).fill(file('image/png',10)),'garden-task-files'));
});

test('upload validates before sending and preserves the original error when cleanup fails',async()=>{
 const {uploadFiles}=await import('../lib/api.ts');
 let uploads=0,removed=[];
 const store={upload:async()=>{uploads++;return {error:uploads===2?{message:'network'}:null}},remove:async paths=>{removed=paths;throw Error('cleanup failed')}};
 const good={type:'image/png',size:10,name:'a.png'};
 await assert.rejects(uploadFiles([good,{type:'bad',size:10,name:'bad'}],'garden-homework','user',store));
 assert.equal(uploads,0);
 const previous=console.warn;console.warn=()=>{};
 try{await assert.rejects(uploadFiles([good,good],'garden-homework','user',store),/Chưa tải được tệp/)}finally{console.warn=previous;}
 assert.equal(uploads,2);assert.equal(removed.length,2);assert.ok(removed.every(path=>path.startsWith('user/')));
});

test('focus and polling events within one second share a refresh window',async()=>{
 const {WakeGate}=await import('../lib/requests.ts');
 const gate=new WakeGate();
 assert.equal(gate.accept(10000),true);
 assert.equal(gate.accept(10005),false);
 assert.equal(gate.accept(11001),true);
});
