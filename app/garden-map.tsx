'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {gardenSlotLabel,plantingSlots,slotScreenPosition,slotUnlockCost,pinchGardenView} from '../lib/garden-map';
import {itemName,plantDefinition,timeLeft,type CatalogItem,type Plot} from '../lib/game';
import {Art,Plant} from './ui';
import styles from './garden-map.module.css';

export function GardenMap({plots,catalog,unlockedSlots,now,onSelect,onUnlock}:{plots:Plot[];catalog:CatalogItem[];unlockedSlots:number[];now:number;onSelect:(slot:number)=>void;onUnlock:(slot:number)=>void}) {
 const field=useRef<HTMLElement>(null);
 const scene=useRef<HTMLDivElement>(null);
 const view=useRef({x:0,y:0,zoom:1});
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<{kind:'drag';x:number;y:number;view:typeof view.current;moved:boolean}|{kind:'pinch';distance:number;center:{x:number;y:number};view:typeof view.current}|null>(null);
 const frame=useRef<number|null>(null);
 const ignoreClickUntil=useRef(0);
 const [size,setSize]=useState({width:0,height:0});
 const [settledView,setSettledView]=useState(view.current);
 const [dragging,setDragging]=useState(false);
 const bySlot=useMemo(()=>new Map(plots.map(plot=>[plot.slot,plot])),[plots]);
 const opened=useMemo(()=>new Set(unlockedSlots),[unlockedSlots]);
 const price=slotUnlockCost(opened.size);
 const paint=useCallback(()=>{
  if(frame.current!==null)return;
  frame.current=requestAnimationFrame(()=>{
   frame.current=null;
   const {x,y,zoom}=view.current;
   if(scene.current)scene.current.style.transform=`translate3d(${x}px,${y}px,0) scale(${zoom})`;
  });
 },[]);
 const updateView=useCallback((next:typeof view.current,settle=false)=>{
  view.current={...next,x:Math.max(-480,Math.min(480,next.x)),y:Math.max(-320,Math.min(320,next.y))};
  paint();
  if(settle)setSettledView(view.current);
 },[paint]);
 const move=useCallback((x:number,y:number)=>{
  updateView({...view.current,x:view.current.x+x,y:view.current.y+y},true);
 },[updateView]);
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
   if(frame.current!==null)cancelAnimationFrame(frame.current);
   root.style.overflow=previousOverflow;root.style.overscrollBehavior=previousOverscroll;
   element.removeEventListener('wheel',panWheel);
  };
 },[move]);
 function startDrag(event:PointerEvent<HTMLElement>) {
  if(event.pointerType==='mouse'&&event.button!==0)return;
  if(pointers.current.size>=2)return;
  pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const points=[...pointers.current.values()];
  if(points.length===1){gesture.current={kind:'drag',...points[0],view:view.current,moved:false};return;}
  const [a,b]=points;
  gesture.current={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},view:view.current};
  for(const id of pointers.current.keys())event.currentTarget.setPointerCapture(id);
  ignoreClickUntil.current=Date.now()+300;
  setDragging(true);
 }
 function moveDrag(event:PointerEvent<HTMLElement>) {
  if(!pointers.current.has(event.pointerId))return;
  pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const active=gesture.current;if(!active)return;
  if(active.kind==='pinch'){
   const [a,b]=[...pointers.current.values()];if(!a||!b)return;
   const rect=event.currentTarget.getBoundingClientRect();
   updateView(pinchGardenView(active.view,active.center,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},active.distance,Math.hypot(a.x-b.x,a.y-b.y),{x:rect.left+rect.width/2,y:rect.top+rect.height/2+90}));
   return;
  }
  const dx=event.clientX-active.x,dy=event.clientY-active.y;
  if(!active.moved&&Math.hypot(dx,dy)<8)return;
  if(!active.moved){active.moved=true;event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}
  updateView({...active.view,x:active.view.x+dx,y:active.view.y+dy});
 }
 function endDrag(event:PointerEvent<HTMLElement>) {
  if(!pointers.current.has(event.pointerId))return;
  const active=gesture.current;
  pointers.current.delete(event.pointerId);
  if(active&&(active.kind==='pinch'||active.moved))ignoreClickUntil.current=Date.now()+300;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const remaining=[...pointers.current.values()][0];
  if(remaining){gesture.current={kind:'drag',...remaining,view:view.current,moved:true};return;}
  gesture.current=null;setDragging(false);setSettledView(view.current);
 }
 return <section ref={field} className={styles.field+' '+(dragging?styles.dragging:'')}
  aria-label="Khu vườn tối đa 16 cây" tabIndex={0}
  onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={event=>{if(event.target===event.currentTarget)endDrag(event);}}
  onKeyDown={event=>{
   const directions:Record<string,[number,number]>={ArrowLeft:[96,0],ArrowRight:[-96,0],ArrowUp:[0,48],ArrowDown:[0,-48]};
   if(event.key==='Home'){event.preventDefault();updateView({...view.current,x:0,y:0},true);}
   else if(directions[event.key]){event.preventDefault();move(...directions[event.key]);}
  }}>
  <div ref={scene} className={styles.scene}>
   <div className={styles.farmSurroundings} aria-hidden="true">
    <div className={styles.path}/>
    <div className={styles.fenceLeft}/><div className={styles.fenceRight}/>
   </div>
  {plantingSlots.map(position=>{
   const plot=bySlot.get(position.id),unlocked=opened.has(position.id),grown=plot&&Date.parse(plot.ready_at)<=now;
   const screen=slotScreenPosition(position,size.width,size.height,settledView,settledView.zoom);
   const visible=screen.x>=55&&screen.x<=size.width-55&&screen.y>=(size.width<=540?250:290)&&screen.y<=size.height-100;
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
  </div>

 </section>;
}
