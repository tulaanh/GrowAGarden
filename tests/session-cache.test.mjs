import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SessionCache} from '../lib/requests.ts';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('tab navigation reuses shared scopes and loads only missing scopes (16 reads become 5)',async()=>{
 const cache=new SessionCache();let reads=0;
 const views=[['profile','catalog','garden','inventory'],['profile','catalog','inventory','collection'],['profile','catalog','garden','inventory'],['profile','catalog','garden','inventory']];
 for(const scopes of views) await Promise.all(scopes.map(key=>cache.load(key,async()=>{reads++;return key;})));
 assert.equal(reads,5);
});
test('cache expires after 60 seconds, failures retain stale data, retry bypasses freshness',async()=>{
 const cache=new SessionCache();await cache.load('garden',async()=>['old']);
 const stamp=cache.get('garden').updatedAt;
 assert.equal(cache.fresh('garden',stamp+59999),true);
 assert.equal(cache.fresh('garden',stamp+60000),false);
 await assert.rejects(cache.load('garden',async()=>{throw Error('offline')},true),/offline/);
 assert.equal(cache.fresh('garden'),false);assert.deepEqual(cache.get('garden').value,['old']);assert.equal(cache.get('garden').updatedAt,stamp);
 await cache.load('garden',async()=>['new'],true);assert.deepEqual(cache.get('garden').value,['new']);
});
test('changes invalidate cached resources even when their screens are closed',async()=>{
 const cache=new SessionCache();cache.track('warehouse',['collection']);cache.track('catalog',['catalog']);
 await cache.load('warehouse',async()=>1);await cache.load('catalog',async()=>21);
 cache.invalidate(['collection']);assert.equal(cache.fresh('warehouse'),false);assert.equal(cache.fresh('catalog'),true);
 await cache.load('warehouse',async()=>6);assert.equal(cache.get('warehouse').value,6);
});
test('cache coalesces requests and discards replaced and previous-session results',async()=>{
 const cache=new SessionCache(),first=deferred(),second=deferred();
 const old=cache.load('garden',()=>first.promise);
 assert.equal(cache.load('garden',()=>{throw Error('duplicate')}),old);
 const current=cache.load('garden',()=>second.promise,true);
 second.resolve('new');await current;first.resolve('old');await old;assert.equal(cache.get('garden').value,'new');
 const pending=deferred();const job=cache.load('garden',()=>pending.promise,true);cache.preferences.set('filter','all');
 cache.reset();pending.resolve('previous user');await job;
 assert.equal(cache.get('garden').value,undefined);assert.equal(cache.preferences.size,0);
});
test('pagination snapshots survive remount and invalidation retains page count and cursor',async()=>{
 const cache=new SessionCache();cache.track('tasks:all',['tasks']);
 const value={items:[{id:'1'},{id:'2'}],pages:2,next:{at:'time',id:'2'}};
 await cache.load('tasks:all',async()=>value);
 await cache.load('tasks:all',()=>{throw Error('fresh pages must not refetch')});
 cache.invalidate(['tasks']);assert.deepEqual(cache.get('tasks:all').value,value);
});
