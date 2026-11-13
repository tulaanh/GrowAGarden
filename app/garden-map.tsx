'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {gardenSlotLabel,plantingSlots,slotScreenPosition,slotUnlockCost,MAX_PLANTING_SLOTS} from '../lib/garden-map';
import {itemName,plantDefinition,timeLeft,type CatalogItem,type Plot} from '../lib/game';
import {Art,Plant} from './ui';
import styles from './garden-map.module.css';

export function GardenMap({plots,catalog,unlockedSlots,now,onSelect,onUnlock}:{plots:Plot[];catalog:CatalogItem[];unlockedSlots:number[];now:number;onSelect:(slot:number)=>void;onUnlock:(slot:number)=>void}) {
 const field=useRef<HTMLElement>(null);
 const drag=useRef<{id:number;x:number;y:number;camera:{x:number;y:number};moved:boolean}|null>(null);
 const ignoreClickUntil=useRef(0);
 const [size,setSize]=useState({width:0,height:0});
 const [camera,setCamera]=useState({x:0,y:0});
 const [dragging,setDragging]=useState(false);
 const bySlot=useMemo(()=>new Map(plots.map(plot=>[plot.slot,plot])),[plots]);
 const positions=useMemo(()=>plantingSlots.map(slot=>({id:slot.id,...slotScreenPosition(slot,size.width,size.height,camera)})),[size,camera]);
 const opened=useMemo(()=>new Set(unlockedSlots),[unlockedSlots]);
 const price=slotUnlockCost(opened.size);
 const move=useCallback((x:number,y:number)=>{
  setCamera(current=>({x:Math.max(-480,Math.min(480,current.x+x)),y:Math.max(-320,Math.min(320,current.y+y))}));
 },[]);
 useEffect(()=>{
  const element=field.current;if(!element)return;
  const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
  observer.observe(element);
  const root=document.documentElement;
  const previousOverflow=root.style.overflow,previousOverscroll=root.style.overscrollBehavior;
  root.style.overflow='hidden';root.style.overscrollBehavior='none';
  const panWheel=(event:WheelEvent)=>{
   if(event.ctrlKey||event.metaKey)return;
   event.preventDefault();
   const unit=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1;
   const horizontal=event.shiftKey&&event.deltaX===0;
   move(-(horizontal?event.deltaY:event.deltaX)*unit,-(horizontal?0:event.deltaY)*unit);
  };
  element.addEventListener('wheel',panWheel,{passive:false});
  return()=>{
   observer.disconnect();
   root.style.overflow=previousOverflow;root.style.overscrollBehavior=previousOverscroll;
   element.removeEventListener('wheel',panWheel);
  };
 },[move]);
 function startDrag(event:PointerEvent<HTMLElement>) {
  if(!event.isPrimary||event.button!==0)return;
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,camera,moved:false};
 }
 function moveDrag(event:PointerEvent<HTMLElement>) {
  const active=drag.current;if(!active||active.id!==event.pointerId)return;
  const dx=event.clientX-active.x,dy=event.clientY-active.y;
  if(!active.moved&&Math.hypot(dx,dy)<8)return;
  if(!active.moved){active.moved=true;event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}
  setCamera({x:Math.max(-480,Math.min(480,active.camera.x+dx)),y:Math.max(-320,Math.min(320,active.camera.y+dy))});
 }
 function endDrag(event:PointerEvent<HTMLElement>) {
  if(drag.current?.id!==event.pointerId)return;
  if(drag.current.moved)ignoreClickUntil.current=Date.now()+200;
  drag.current=null;setDragging(false);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }
 return <section ref={field} className={styles.field+' '+(dragging?styles.dragging:'')}
  aria-label="Khu vườn tối đa 16 cây" aria-describedby="garden-map-help" tabIndex={0}
  onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
  onKeyDown={event=>{
   const directions:Record<string,[number,number]>={ArrowLeft:[96,0],ArrowRight:[-96,0],ArrowUp:[0,48],ArrowDown:[0,-48]};
   if(event.key==='Home'){event.preventDefault();setCamera({x:0,y:0});}
   else if(directions[event.key]){event.preventDefault();move(...directions[event.key]);}
  }}>
  {positions.map(position=>{
   const plot=bySlot.get(position.id),unlocked=opened.has(position.id),grown=plot&&Date.parse(plot.ready_at)<=now;
   const visible=position.x>=55&&position.x<=size.width-55&&position.y>=(size.width<=540?250:290)&&position.y<=size.height-100;
   return <div data-planting-slot={position.id} key={position.id}>
    <div className={styles.ground+' '+(!unlocked&&!plot?styles.lockedGround:'')} style={{left:position.x,top:position.y}}>
     <img src="/art/farm/items/plot_grass.png" alt="" width="512" height="256" draggable={false}/>
    </div>
    {unlocked||plot?<div className={styles.position} style={{left:position.x,top:position.y,zIndex:Math.round(position.y)+2000}} aria-hidden={!visible}>
     <button type="button" className={'plot '+styles.plot+' '+(grown?'grown ':'')+(plot&&plantDefinition(plot.seed_id)?.ground?'has-baked-ground':'')}
      tabIndex={visible?0:-1} onClick={()=>{if(Date.now()>=ignoreClickUntil.current)onSelect(position.id);}}
      aria-label={gardenSlotLabel(position.id)+(plot?': '+itemName(plot.seed_id,catalog)+', '+timeLeft(plot.ready_at,now):': đất trống')}>
      <span className={'soil '+(!plot||!plantDefinition(plot.seed_id)?.ground?'image-soil':'')}>{(!plot||!plantDefinition(plot.seed_id)?.ground)&&<Art name={'farm/items/'+(plot?'soil_tilled':'soil_unworked')}/>}</span>
      {plot?<Plant plot={plot} now={now}/>:<span className="plot-plus">+</span>}
      {grown&&<span className="harvest-tag">Thu hoạch</span>}
      <span className="plot-number">{position.id+1}{!unlocked?' · khóa sau thu hoạch':''}</span>
     </button>
    </div>:<button type="button" className={styles.lockedSlot} style={{left:position.x,top:position.y}} tabIndex={visible?0:-1}
      aria-label={'Mở vị trí trồng '+(position.id+1)+' · '+price+' Đồng tri thức'}
      onClick={()=>{if(Date.now()>=ignoreClickUntil.current)onUnlock(position.id);}}>
      <span className={styles.lockLabel}>
       <strong><svg width="13" height="16" viewBox="0 0 22 24" aria-hidden="true"><path d="M6 10V6a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.5"/><rect x="2" y="10" width="18" height="13" rx="3" fill="currentColor"/></svg>Vị trí {position.id+1}</strong>
       <span>{price?.toLocaleString('vi-VN')} ĐT</span>
      </span>
     </button>}
   </div>;
  })}
  <div className={styles.help} onPointerDown={event=>event.stopPropagation()}>
   <div><strong>Đã mở {opened.size}/{MAX_PLANTING_SLOTS} vị trí</strong><span id="garden-map-help">Mỗi vị trí trồng 1 cây · Kéo để di chuyển</span></div>
   <button type="button" onClick={()=>setCamera({x:0,y:0})}>Về giữa</button>
  </div>
 </section>;
}
