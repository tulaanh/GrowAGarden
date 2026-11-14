'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {motion,useReducedMotion} from 'framer-motion';
import {plantVisual,type Plot,type GameData,seedOdds,itemName} from '../lib/game';
import farmArt from '../lib/farm-art.json';

export function Icon({name}:{name:string}){
 const shapes:Record<string,React.ReactNode>={
 garden:<><path d="m3 17 9-5 9 5-9 5z" fill="#a97441"/><path d="M12 16V6M12 10Q3 10 5 4q7 0 7 6M12 9q0-8 7-7 2 6-7 7" stroke="#385c28" strokeWidth="2" fill="#88bf4a"/></>,
 tasks:<><path d="M5 4h14v17H5z" fill="#ffe9ae" stroke="#82552b" strokeWidth="1.5"/><path d="M9 2h6v4H9z" fill="#c58b4c"/><path d="m8 10 1 1 2-3m2 2h3m-8 5 1 1 2-3m2 2h3" fill="none" stroke="#80542d" strokeWidth="1.5"/></>,
 shop:<><path d="M3 10h18l-2 11H5z" fill="#c58b4d" stroke="#744623" strokeWidth="1.5"/><path d="M7 11Q6 1 12 2q6-1 5 9" fill="none" stroke="#82542a" strokeWidth="2"/><path d="m7 13 2 6m3-6v6m5-6-2 6" stroke="#f5ca78" strokeWidth="2"/></>,
 warehouse:<><path d="M3 9h18v12H3z" fill="#d49b58" stroke="#744623" strokeWidth="1.5"/><path d="M2 9l2-4h16l2 4z" fill="#efc27e" stroke="#744623" strokeWidth="1.5" strokeLinejoin="round"/><path d="M3 12h18M8 12v9m8-9v9" fill="none" stroke="#a46b35" strokeWidth="1.2"/><path d="M10 15h4v3h-4z" fill="#ffe6a3" stroke="#82542a" strokeWidth="1"/></>,
 dollar:<><circle cx="12" cy="12" r="10" fill="#d9edb5" stroke="#4b7134" strokeWidth="1.5"/><path d="M16 7h-5a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6H8M12 4v17" fill="none" stroke="#3b612b" strokeWidth="2" strokeLinecap="round"/></>,
 account:<><circle cx="12" cy="8" r="5" fill="#ffda9b" stroke="#79532f" strokeWidth="1.5"/><path d="M3 22q0-10 9-10t9 10" fill="#87b773" stroke="#436940" strokeWidth="1.5"/></>,
 fertilizer:<><path d="M8 2h8v5l4 11q2 4-3 4H7q-5 0-3-4L8 7z" fill="#f8cf72" stroke="#7a552d" strokeWidth="1.5"/><path d="M12 18v-7m0 3q-6 0-5-4 5 0 5 4m0 2q0-6 5-5 0 5-5 5" fill="#78ad4b" stroke="#497a38" strokeWidth="1"/></>,
 coin:<><circle cx="12" cy="12" r="10" fill="#ffce4a" stroke="#a66a16" strokeWidth="1.5"/><path d="m12 5 2 4 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z" fill="#fff3b3"/></>,
 };return <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">{shapes[name]??shapes.garden}</svg>;
}
export function Art({name,className='',alt=''}:{name:string;className?:string;alt?:string}){
 const crop=name.startsWith('farm/plants/'),item=name.startsWith('farm/items/'),soil=name.startsWith('farm/items/soil_');
 return <img className={'art '+className} src={'/art/'+name+'.webp'} width={crop||item?256:name==='sign'?1200:640} height={soil?144:crop?384:item?256:name==='sign'?400:640} alt={alt} draggable={false}/>;
}
export function Plant({plot,now}:{plot:Plot;now:number}){
 const visual=plantVisual(plot,now),reduced=useReducedMotion();
 const metrics=farmArt.plants[plot.seed_id as keyof typeof farmArt.plants]||farmArt.plants.carrot;
 const style={'--sprite-width':512/metrics.render_span,'--sprite-height':768/metrics.render_span,'--sprite-bottom':-48/metrics.render_span} as React.CSSProperties;
 return <motion.span className={'plant-art farm-plant '+(metrics.ground_baked?'with-ground':'without-ground')} style={style} key={visual.art} initial={reduced?false:{opacity:.6}} animate={{opacity:1}} transition={{duration:reduced?0:.4}}><Art name={visual.art}/></motion.span>;
}
export function SeedOdds({id,data,revealAll=false}:{id:string;data:GameData;revealAll?:boolean}) {
 const [open,setOpen]=useState(false);
 const odds=seedOdds(id,data.drops,data.catalog);
 const known=odds.filter(d=>revealAll||data.discoveredSeeds.includes(d.plant_id));
 const unknown=odds.filter(d=>!revealAll&&!data.discoveredSeeds.includes(d.plant_id)).reduce((sum,d)=>sum+d.percent,0);
 return <div className="seed-odds"><button type="button" className="seed-odds-trigger" aria-haspopup="dialog" onClick={e=>{e.currentTarget.focus({preventScroll:true});setOpen(true);}}>Cây có thể nhận & tỷ lệ</button>{open&&createPortal(
  <Dialog title={'Cây có thể nhận · '+itemName(id,data.catalog)} className="odds-dialog" onClose={()=>setOpen(false)}><div className="seed-odds seed-odds-modal">{odds.length?<ul>{known.map(d=>{
  const plant=data.catalog.find(c=>c.id===d.plant_id)!;
  return <li key={d.plant_id}><strong>{itemName(d.plant_id,data.catalog)} · {Number(d.percent.toFixed(1))}%</strong><span>{Math.round(plant.grow_seconds/60)} phút · {plant.xp} XP</span></li>;
 })}{unknown>0&&<li><strong>Cây chưa khám phá · {Number(unknown.toFixed(1))}%</strong><span>Gieo hạt để khám phá</span></li>}</ul>:<p>Hạt này hiện chưa có cây để gieo.</p>}</div></Dialog>,document.body)}</div>;
}
export function Dialog({title,children,onClose,drawer=false,className=''}:{title:string;children:React.ReactNode;onClose:()=>void;drawer?:boolean;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useLayoutEffect(()=>{
  const d=ref.current;
  const opener=document.activeElement as HTMLElement|null;
  d?.showModal();
  return()=>{if(d?.open)d.close();requestAnimationFrame(()=>{if(opener?.isConnected&&opener!==document.body)opener.focus({preventScroll:true});else(document.querySelector('[aria-current="page"]') as HTMLElement|null)?.focus({preventScroll:true});});};
 },[]);
 return <dialog ref={ref} className={'dialog '+(drawer?'drawer ':'')+className} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} aria-label={title}>
  <div className="dialog-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Đóng" onClick={onClose}>×</button></div>{children}
 </dialog>;
}
export function Empty({title,children}:{title:string;children:React.ReactNode}){return <div className="empty"><Art name="farm/plants/carrot/stage-02"/><h3>{title}</h3><p>{children}</p></div>;}
export function FilePicker({files,onChange,pdf=false,id}:{files:File[];onChange:(files:File[])=>void;pdf?:boolean;id:string}){
 return <div className="file-picker"><label htmlFor={id}>Chọn {pdf?'ảnh hoặc PDF':'ảnh bài làm'} <span>Tối đa 5 tệp, 10 MB/tệp</span></label><input id={id} type="file" multiple accept={pdf?'image/jpeg,image/png,image/webp,application/pdf':'image/jpeg,image/png,image/webp,image/heic,image/heif'} onChange={e=>onChange(Array.from(e.target.files||[]))}/>{files.length>0&&<ul>{files.map((f,i)=><li key={i}>{f.name}</li>)}</ul>}</div>;
}
export function Money({amount}:{amount:number}){return <span className="money"><Icon name="coin"/>{amount.toLocaleString('vi-VN')} <span>Đồng tri thức</span></span>;}
export function DateLabel({value}:{value:string|null}){return <>{value?new Date(value).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'}):'Không giới hạn'}</>;}
export function FileLinks({files,onOpen}:{files:string[];onOpen:(path:string)=>void}){return <div className="file-links">{files.map((f,i)=><button className="secondary" key={f} onClick={()=>onOpen(f)}>Tệp {i+1}: {f.split('/').pop()}</button>)}</div>;}

export function VndMoney({amount}:{amount:number}){return <span className="money vnd-money"><Icon name="dollar"/>{amount.toLocaleString("vi-VN")} <span>VNĐ</span></span>;}
