import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpile(readFileSync(new URL('../lib/garden-map.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.ES2022});
const {gardenSlotLabel,plantingSlots,gardenGridPosition,gardenSurroundings,gardenFence,slotUnlockCost,slotScreenPosition,pinchGardenView,INITIAL_OPEN_SLOTS,MAX_GARDEN_SLOT,SLOT_WIDTH,SLOT_HEIGHT}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

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
 assert.deepEqual(slotScreenPosition(slot,1280,720,{x:0,y:0}),{x:640,y:336});
 assert.deepEqual(slotScreenPosition(slot,390,844,{x:0,y:0}),{x:195,y:398});
 assert.deepEqual(slotScreenPosition(slot,1280,720,{x:96,y:48}),{x:736,y:384});
 assert.equal(slot.id,0);
});

test('paths and meadow fill complete tile rings without covering planting positions',()=>{
 assert.equal(gardenSurroundings.length,48);
 const allTiles=[...plantingSlots,...gardenSurroundings];
 assert.equal(new Set(allTiles.map(tile=>`${tile.x},${tile.y}`)).size,64);
 for(const tile of gardenSurroundings){
  assert.ok(Number.isInteger(tile.column)&&Number.isInteger(tile.row));
  assert.ok(tile.column<0||tile.column>3||tile.row<0||tile.row>3);
  if(tile.column>=-1&&tile.column<=4&&tile.row>=-1&&tile.row<=4)assert.equal(tile.kind,'path');
 }
 const origin=gardenGridPosition(0,0),column=gardenGridPosition(1,0),row=gardenGridPosition(0,1);
 assert.deepEqual({x:column.x-origin.x,y:column.y-origin.y},{x:SLOT_WIDTH/2,y:SLOT_HEIGHT/2});
 assert.deepEqual({x:row.x-origin.x,y:row.y-origin.y},{x:-SLOT_WIDTH/2,y:SLOT_HEIGHT/2});
});

test('fence follows tile edges and leaves a two-tile entrance connected to the path',()=>{
 assert.equal(gardenFence.length,22);
 for(const segment of gardenFence){
  assert.ok(segment.axis==='column'?[-1.5,4.5].includes(segment.row):[-1.5,4.5].includes(segment.column));
 }
 for(const column of [1,2]){
  assert.ok(!gardenFence.some(segment=>segment.row===4.5&&segment.column===column));
  for(const row of [4,5])assert.equal(gardenSurroundings.find(tile=>tile.column===column&&tile.row===row)?.kind,'path');
 }
});

test('decoration and planting positions share the same projection while zooming and panning',()=>{
 const tile=gardenSurroundings.find(tile=>tile.column===-1&&tile.row===0);
 const plot=gardenGridPosition(0,0);
 for(const zoom of [.5,.8,1,1.6]){
  const camera={x:117,y:-63};
  const a=slotScreenPosition(tile,390,844,camera,zoom),b=slotScreenPosition(plot,390,844,camera,zoom);
  assert.ok(Math.abs(b.x-a.x-SLOT_WIDTH/2*zoom)<1e-8);
  assert.ok(Math.abs(b.y-a.y-SLOT_HEIGHT/2*zoom)<1e-8);
 }
});

test('pinch zoom keeps the touched garden point under the fingers and respects zoom limits',()=>{
 const origin={x:195,y:512},start={x:225,y:542},view={x:10,y:20,zoom:1};
 assert.deepEqual(pinchGardenView(view,start,start,100,150,origin),{x:0,y:15,zoom:1.5});
 assert.deepEqual(pinchGardenView(view,start,{x:235,y:552},100,150,origin),{x:10,y:25,zoom:1.5});
 assert.equal(pinchGardenView(view,start,start,100,300,origin).zoom,1.6);
 assert.equal(pinchGardenView(view,start,start,100,10,origin).zoom,0.5);
});
