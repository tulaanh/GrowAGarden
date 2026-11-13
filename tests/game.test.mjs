import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpile(readFileSync(new URL('../lib/game.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.ES2022});
const {levelInfo,levelTitle,discoveredSeedIds,timeLeft,growth,plantVisual,plantArt,plantStages,plants,catalogArt,harvestArt,defaults,seedOdds,defaultDrops}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('seed discovery includes starters and gacha plants, including harvested plants',()=>{
 assert.deepEqual(discoveredSeedIds([]),['carrot','rice']);
 assert.deepEqual(discoveredSeedIds([{seed_id:'tomato',source_seed_id:'gacha_rare',harvested:true},{seed_id:'onion',source_seed_id:'onion'},{seed_id:'tomato',source_seed_id:'gacha_common'}]),['carrot','rice','tomato']);
});
test('level titles match the selected progression and remain available after level 20',()=>{
 assert.equal(levelTitle(1),'Hạt Mầm Tri Thức');
 assert.equal(levelTitle(6),'Người Nuôi Dưỡng Mầm Xanh');
 assert.equal(levelTitle(20),'Huyền Thoại Vườn Tri Thức');
 assert.equal(levelTitle(50),'Huyền Thoại Vườn Tri Thức');
});
test('level thresholds match cumulative XP',()=>{
 assert.equal(levelInfo(0).level,1);assert.equal(levelInfo(99).level,1);assert.equal(levelInfo(100).level,2);assert.equal(levelInfo(299).level,2);assert.equal(levelInfo(300).level,3);assert.equal(levelInfo(600).level,4);
 assert.deepEqual(levelInfo(120),{level:2,current:20,needed:200,progress:10});
});
test('growth is clamped and ready after closing the app',()=>{
 const p={planted_at:new Date(1000).toISOString(),ready_at:new Date(11000).toISOString()};
 assert.equal(growth(p,0),0);assert.equal(growth(p,6000),.5);assert.equal(growth(p,20000),1);
 assert.equal(timeLeft(p.ready_at,20000),'Sẵn sàng thu hoạch');
});
test('fertilizer advances growth using the planted duration snapshot',()=>{
 const p={seed_id:'mango',planted_at:new Date(0).toISOString(),ready_at:new Date(70000).toISOString(),growth_seconds:100};
 assert.equal(growth(p,20000),.5);
 assert.equal(plantVisual(p,70000).stage,5);
 assert.equal(plantVisual(p,100000).stage,5);
});
test('all 21 species use their new growth sprites; ripe frame waits until ready',()=>{
 assert.equal(plants.length,21);
 assert.deepEqual([...new Set(Object.values(plantStages))].sort(),[3,4,5]);
 for(const [id,total] of Object.entries(plantStages)){
  const p={seed_id:id,planted_at:new Date(0).toISOString(),ready_at:new Date(100000).toISOString(),growth_seconds:100};
  const seen=new Set();
  for(let now=0;now<=100000;now+=100){
   const v=plantVisual(p,now);seen.add(v.stage);
   assert.equal(v.total,total);
   if(now<100000)assert.ok(v.stage<total);
   assert.ok(existsSync(new URL('../public/art/'+v.art+'.webp',import.meta.url)),v.art);
  }
  assert.deepEqual([...seen],Array.from({length:total},(_,i)=>i+1));
  assert.equal(plantVisual(p,0).art,plantArt(id,1));
  assert.equal(plantVisual(p,100000).art,plantArt(id));
 }
});
test('gacha odds sum to 100 and exclude disabled species',()=>{
 for(const item of defaults.filter(c=>c.kind==='gacha')){
  assert.ok(existsSync(new URL('../public/art/'+catalogArt(item)+'.webp',import.meta.url)));
  const odds=seedOdds(item.id,defaultDrops,defaults);
  assert.equal(odds.length,21);
  assert.ok(Math.abs(odds.reduce((sum,d)=>sum+d.percent,0)-100)<1e-9);
 }
 const catalog=defaults.map(c=>({...c,active:c.id==='carrot'}));
 assert.deepEqual(seedOdds('gacha_special',defaultDrops,catalog).map(d=>[d.plant_id,d.percent]),[['carrot',100]]);
 assert.deepEqual(seedOdds('gacha_common',defaultDrops,defaults.map(c=>({...c,active:false}))),[]);
});
test('new seed packets and harvested produce exist for every species',()=>{
 const art=JSON.parse(readFileSync(new URL('../lib/farm-art.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(art.plants).length,21);
 assert.equal(art.assets.length,147);
 for(const item of defaults.filter(c=>c.kind==='seed')){
  for(const name of [catalogArt(item),harvestArt(item.id)]){
   assert.ok(name.startsWith('farm/'));
   assert.ok(existsSync(new URL('../public/art/'+name+'.webp',import.meta.url)),name);
  }
  const definition=plants.find(p=>p.id===item.id);
  assert.equal(definition.ground,art.plants[item.id].ground_baked);
  assert.ok(art.plants[item.id].render_span>0);
  assert.deepEqual(art.plants[item.id].stages,[1,2,3,4,5]);
 }
 assert.ok(!defaults.some(c=>['sunflower','lotus'].includes(c.id)));
});
