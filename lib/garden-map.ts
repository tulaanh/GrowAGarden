export const SLOT_WIDTH = 192;
export const SLOT_HEIGHT = 96;
export const GARDEN_ORIGIN_Y = 24;
export const MAX_PLANTING_SLOTS = 16;
export const INITIAL_OPEN_SLOTS = [0,1,2,3];
export const MAX_GARDEN_SLOT = MAX_PLANTING_SLOTS-1;

// Integer coordinates describe one shared ground plane, including the garden border.
export function gardenGridPosition(column:number,row:number) {
 return {x:(column-row)*SLOT_WIDTH/2,y:(column+row-3)*SLOT_HEIGHT/2};
}

const coordinates = [[1,1],[2,1],[1,2],[2,2],[0,0],[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[1,3],[2,3],[0,3],[3,3]] as const;
export const plantingSlots=coordinates.map(([column,row],id)=>({id,...gardenGridPosition(column,row)}));

export const gardenSurroundings=Array.from({length:64},(_,index)=>{
 const column=index%8-2,row=Math.floor(index/8)-2;
 const border=column===-2||column===5||row===-2||row===5;
 const entrance=row===5&&(column===1||column===2);
 return {column,row,...gardenGridPosition(column,row),kind:border&&!entrance?'grass' as const:'path' as const};
}).filter(({column,row})=>column<0||column>3||row<0||row>3);

export const gardenFence=Array.from({length:6},(_,index)=>index-1).flatMap(index=>[
 {id:`back-left-${index}`,column:-1.5,row:index,axis:'row' as const},
 {id:`back-right-${index}`,column:index,row:-1.5,axis:'column' as const},
 ...([1,2].includes(index)?[]:[{id:`front-left-${index}`,column:index,row:4.5,axis:'column' as const}]),
 {id:`front-right-${index}`,column:4.5,row:index,axis:'row' as const},
]).map(segment=>({...segment,...gardenGridPosition(segment.column,segment.row)}));

export function gardenSlotLabel(slot:number) {
 if(!Number.isInteger(slot)||slot<0||slot>MAX_GARDEN_SLOT)throw new RangeError('Invalid planting position');
 return 'Vị trí trồng '+(slot+1);
}

export function slotUnlockCost(unlockedCount:number) {
 return unlockedCount>=MAX_PLANTING_SLOTS?null:(Math.max(INITIAL_OPEN_SLOTS.length,unlockedCount)-INITIAL_OPEN_SLOTS.length+1)*100;
}

export function slotScreenPosition(slot:{x:number;y:number},width:number,height:number,camera:{x:number;y:number},zoom=1) {
 return {x:width/2+camera.x+slot.x*zoom,y:height/2+GARDEN_ORIGIN_Y+camera.y+slot.y*zoom};
}

export function pinchGardenView(view:{x:number;y:number;zoom:number},start:{x:number;y:number},center:{x:number;y:number},startDistance:number,distance:number,origin:{x:number;y:number}) {
 const zoom=Math.max(0.8,Math.min(1.6,view.zoom*distance/Math.max(1,startDistance)));
 const ratio=zoom/view.zoom;
 return {x:center.x-origin.x-(start.x-origin.x-view.x)*ratio,y:center.y-origin.y-(start.y-origin.y-view.y)*ratio,zoom};
}
