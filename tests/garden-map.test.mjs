import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpile(readFileSync(new URL('../lib/garden-map.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.ES2022});
const {gardenSlotLabel,plantingSlots,slotUnlockCost,slotScreenPosition,INITIAL_OPEN_SLOTS,MAX_GARDEN_SLOT,SLOT_WIDTH,SLOT_HEIGHT}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('the whole garden has exactly sixteen single-plant positions, four open initially',()=>{
 assert.equal(plantingSlots.length,16);
 assert.deepEqual(plantingSlots.map(slot=>slot.id),Array.from({length:16},(_,id)=>id));
 assert.equal(new Set(plantingSlots.map(slot=>slot.x+','+slot.y)).size,16);
 assert.deepEqual(INITIAL_OPEN_SLOTS,[0,1,2,3]);
 assert.equal(MAX_GARDEN_SLOT,15);
 assert.equal(gardenSlotLabel(15),'Vị trí trồng 16');
 for(const slot of [-1,16,144,1.5])assert.throws(()=>gardenSlotLabel(slot),RangeError);
});

test('unlocking the twelve remaining positions costs 100 through 1200 coins',()=>{
 const costs=Array.from({length:12},(_,index)=>slotUnlockCost(index+4));
 assert.deepEqual(costs,Array.from({length:12},(_,index)=>(index+1)*100));
 assert.equal(costs.reduce((sum,cost)=>sum+cost,0),7800);
 assert.equal(slotUnlockCost(16),null);
});

test('panning and resizing preserve single-plant identities and fixed dimensions',()=>{
 const slot=plantingSlots[0];
 assert.equal(SLOT_WIDTH,192);assert.equal(SLOT_HEIGHT,96);
 assert.deepEqual(slotScreenPosition(slot,1280,720,{x:0,y:0}),{x:640,y:402});
 assert.deepEqual(slotScreenPosition(slot,390,844,{x:0,y:0}),{x:195,y:464});
 assert.deepEqual(slotScreenPosition(slot,1280,720,{x:96,y:48}),{x:736,y:450});
 assert.equal(slot.id,0);
});
