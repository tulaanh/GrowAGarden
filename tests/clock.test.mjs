import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useClock} from '../app/data-hooks.ts';

test('garden clock updates its component without rerendering its parent and pauses while hidden',async()=>{
 const original={document:globalThis.document,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,now:Date.now,error:console.error};
 const listeners=new Map();let tick;let now=1000;let parentRenders=0;let childRenders=0;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name)=>listeners.delete(name)};
 globalThis.setInterval=fn=>{tick=fn;return 1};globalThis.clearInterval=()=>{tick=undefined};Date.now=()=>now;
 console.error=(...args)=>{if(!String(args[0]).includes('react-test-renderer is deprecated'))original.error(...args)};
 function Clock(){useClock();childRenders++;return React.createElement('span')}
 function Parent(){parentRenders++;return React.createElement(Clock)}
 let root;
 try{
  await act(async()=>{root=TestRenderer.create(React.createElement(Parent))});
  const initial=childRenders;now=2000;
  await act(async()=>tick());
  assert.ok(childRenders>initial);assert.equal(parentRenders,1);
  await act(async()=>{document.visibilityState='hidden';listeners.get('visibilitychange')()});
  assert.equal(tick,undefined);
  await act(async()=>root.unmount());
 }finally{globalThis.document=original.document;globalThis.setInterval=original.setInterval;globalThis.clearInterval=original.clearInterval;Date.now=original.now;console.error=original.error;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
