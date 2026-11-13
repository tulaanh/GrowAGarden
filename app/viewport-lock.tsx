'use client';
import {useEffect} from 'react';

export function ViewportLock() {
 useEffect(()=>{
  const preventGestureZoom=(event:Event)=>event.preventDefault();
  const preventWheelZoom=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey)event.preventDefault();};
  const preventKeyboardZoom=(event:KeyboardEvent)=>{
   if((event.ctrlKey||event.metaKey)&&['+','=','-','_','0'].includes(event.key))event.preventDefault();
  };
  document.addEventListener('wheel',preventWheelZoom,{passive:false,capture:true});
  window.addEventListener('keydown',preventKeyboardZoom,true);
  document.addEventListener('gesturestart',preventGestureZoom,{passive:false});
  document.addEventListener('gesturechange',preventGestureZoom,{passive:false});
  return()=>{
   document.removeEventListener('wheel',preventWheelZoom,true);
   window.removeEventListener('keydown',preventKeyboardZoom,true);
   document.removeEventListener('gesturestart',preventGestureZoom);
   document.removeEventListener('gesturechange',preventGestureZoom);
  };
 },[]);
 return null;
}
