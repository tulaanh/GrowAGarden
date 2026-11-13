'use client';
import {catalogArt,catalogLabel,seedOdds,type CatalogItem,type GameData} from '../lib/game';
import {Art,SeedOdds} from './ui';
import styles from './seed-picker.module.css';

export function SeedPicker({data,busy,onPlant}:{data:GameData;busy:boolean;onPlant:(item:CatalogItem)=>void}) {
 const owned=(id:string)=>data.inventory.find(item=>item.item_id===id)?.quantity||0;
 return <div className={styles.list}>{data.catalog.filter(item=>item.kind==='gacha'||(item.kind==='seed'&&owned(item.id)>0)).map(item=><div className={styles.choice} key={item.id}>
  <button type="button" className={styles.option} disabled={busy||owned(item.id)===0||(item.kind==='gacha'&&!seedOdds(item.id,data.drops,data.catalog).length)} onClick={()=>onPlant(item)}>
   <Art name={catalogArt(item)}/>
   <span><strong>{catalogLabel(item)}</strong><small>{item.kind==='gacha'?'Khám phá cây khi gieo':Math.round(item.grow_seconds/60)+' phút · '+item.xp+' XP'}</small></span>
   <b aria-label={'Trong kho: '+owned(item.id)}>×{owned(item.id)}</b>
  </button>
  {item.kind==='gacha'&&<SeedOdds id={item.id} data={data}/>}
 </div>)}</div>;
}
