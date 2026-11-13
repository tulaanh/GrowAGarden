export const SLOT_WIDTH = 192;
export const SLOT_HEIGHT = 96;
export const MAX_PLANTING_SLOTS = 16;
export const INITIAL_OPEN_SLOTS = [0,1,2,3];
export const MAX_GARDEN_SLOT = MAX_PLANTING_SLOTS-1;

const coordinates = [[1,1],[2,1],[1,2],[2,2],[0,0],[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[1,3],[2,3],[0,3],[3,3]] as const;
export const plantingSlots=coordinates.map(([column,row],id)=>({id,x:(column-row)*SLOT_WIDTH/2,y:(column+row-3)*SLOT_HEIGHT/2}));

export function gardenSlotLabel(slot:number) {
 if(!Number.isInteger(slot)||slot<0||slot>MAX_GARDEN_SLOT)throw new RangeError('Invalid planting position');
 return 'Vị trí trồng '+(slot+1);
}

export function slotUnlockCost(unlockedCount:number) {
 return unlockedCount>=MAX_PLANTING_SLOTS?null:(Math.max(INITIAL_OPEN_SLOTS.length,unlockedCount)-INITIAL_OPEN_SLOTS.length+1)*100;
}

export function slotScreenPosition(slot:{x:number;y:number},width:number,height:number,camera:{x:number;y:number},zoom=1) {
 return {x:width/2+camera.x+slot.x*zoom,y:height/2+90+camera.y+slot.y*zoom};
}

export function pinchGardenView(view:{x:number;y:number;zoom:number},start:{x:number;y:number},center:{x:number;y:number},startDistance:number,distance:number,origin:{x:number;y:number}) {
 const zoom=Math.max(0.8,Math.min(1.6,view.zoom*distance/Math.max(1,startDistance)));
 const ratio=zoom/view.zoom;
 return {x:center.x-origin.x-(start.x-origin.x-view.x)*ratio,y:center.y-origin.y-(start.y-origin.y-view.y)*ratio,zoom};
}
