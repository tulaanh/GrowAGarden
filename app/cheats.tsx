'use client';
import {useState} from 'react';
import {rpc} from '../lib/api';
import {catalogLabel,type GameData} from '../lib/game';
import type {Run} from './page';

export function CheatMenu({data,userId,busy,run,error}:{data:GameData;userId:string;busy:boolean;run:Run;error:string}){
 const [coins,setCoins]=useState(1000),[xp,setXp]=useState(100),[quantity,setQuantity]=useState(10),[item,setItem]=useState('gacha_common');
 const valid=(amount:number,max:number)=>Number.isInteger(amount)&&amount>=1&&amount<=max;
 const growing=data.plots.filter(p=>Date.parse(p.ready_at)>Date.now()).length;
 function apply(action:string,amount:number,itemId:string|null,message:string){
  run(async()=>{await rpc('garden_cheat',{p_action:action,p_amount:amount,p_item:itemId,p_request:crypto.randomUUID()});},message);
 }
 return <div className="cheat-menu">
  <h3>Cheat menu</h3><p className="panel-description">Áp dụng cho tài khoản quản lý đang đăng nhập: <strong>{data.people.find(p=>p.user_id===userId)?.display_name||'Admin'}</strong>.</p>
  <div className="cheat-grid">
   <form className="cheat-card" onSubmit={e=>{e.preventDefault();apply('coins',coins,null,'Đã cấp Đồng tri thức cho tài khoản admin.');}}>
    <h4>Đồng tri thức</h4><label htmlFor="cheat-coins">Số Đồng tri thức cộng thêm</label><input id="cheat-coins" type="number" min={1} max={1000000} step={1} required value={coins} onChange={e=>setCoins(Number(e.target.value))}/>
    <button className="primary" disabled={busy||!valid(coins,1000000)}>Cộng Đồng tri thức</button>
   </form>
   <form className="cheat-card" onSubmit={e=>{e.preventDefault();apply('xp',xp,null,'Đã cộng XP cho tài khoản admin.');}}>
    <h4>Kinh nghiệm trồng cây</h4><label htmlFor="cheat-xp">Số XP cộng thêm</label><input id="cheat-xp" type="number" min={1} max={1000000} step={1} required value={xp} onChange={e=>setXp(Number(e.target.value))}/>
    <button className="primary" disabled={busy||!valid(xp,1000000)}>Cộng XP</button>
   </form>
   <form className="cheat-card" onSubmit={e=>{e.preventDefault();apply('inventory',quantity,item,'Đã thêm vật phẩm vào kho admin.');}}>
    <h4>Hạt giống & phân bón</h4><label htmlFor="cheat-item">Vật phẩm</label><select id="cheat-item" value={item} onChange={e=>setItem(e.target.value)}>{data.catalog.map(c=><option key={c.id} value={c.id}>{catalogLabel(c)}</option>)}</select>
    <label htmlFor="cheat-quantity">Số lượng thêm</label><input id="cheat-quantity" type="number" min={1} max={9999} step={1} required value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/>
    <button className="primary" disabled={busy||!valid(quantity,9999)}>Thêm vào kho</button>
   </form>
   <section className="cheat-card">
    <h4>Làm chín cây</h4><p>Đưa {growing} cây đang lớn trong vườn admin về trạng thái sẵn sàng thu hoạch.</p>
    <button className="primary" disabled={busy||growing===0} onClick={()=>apply('ready_all',0,null,'Cây trong vườn admin đã sẵn sàng thu hoạch.')}>Làm chín tất cả cây</button>
   </section>
  </div>
  {error&&<p className="inline-error" role="alert">{error}</p>}
 </div>;
}
