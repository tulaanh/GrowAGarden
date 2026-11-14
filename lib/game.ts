export type CatalogItem = { id: string; name: string; kind: 'seed' | 'gacha' | 'fertilizer'; price: number; grow_seconds: number; xp: number; min_level: number; reduction_seconds: number; active: boolean; retired?: boolean };
export type Profile = { user_id: string; coins: number; xp: number; display_name: string };
export type Plot = { id: string; slot: number; seed_id: string; source_seed_id: string | null; planted_at: string; ready_at: string; next_water_at: string; growth_seconds: number; xp_reward: number; harvested: boolean };
export type SeedDrop = { seed_id: string; plant_id: string; weight: number };
export type Task = { id: string; title: string; body: string; reward: number; due_at: string | null; status: 'draft'|'published'|'hidden'; files: string[] };
export type Progress = { id: string; user_id: string; task_id: string; status: 'submitted'|'returned'|'approved'; reward_snapshot: number; submitted_at: string; approved_at: string | null; bonus_given: boolean };
export type Attempt = { id: string; progress_id: string; user_id: string; files: string[]; created_at: string };
export type Review = { id: string; progress_id: string; action: 'approved'|'returned'|'bonus'; note: string; amount: number; created_at: string };
export type LedgerEntry = { id: string; amount: number; kind: string; note: string; created_at: string };
export type Inventory = { item_id: string; quantity: number };
export type Crop = { seed_id: string; quantity: number };
export type GameData = { profile: Profile | null; manager: boolean; plots: Plot[]; unlockedSlots: number[]; discoveredSeeds: string[]; catalog: CatalogItem[]; drops: SeedDrop[]; inventory: Inventory[]; collection: Crop[] };
export type PlantDefinition = {id:string;name:string;tier:1|2|3;minutes:number;xp:number;frames:number[];ground:boolean;orchard?:boolean};
export const plants: PlantDefinition[] = [
 {id:'carrot',name:'Cà rốt',tier:1,minutes:30,xp:20,frames:[1,3,5],ground:true},
 {id:'rice',name:'Lúa',tier:1,minutes:60,xp:30,frames:[1,3,5],ground:true},
 {id:'onion',name:'Hành tây',tier:1,minutes:90,xp:30,frames:[1,3,5],ground:true},
 {id:'lettuce',name:'Xà lách',tier:1,minutes:45,xp:20,frames:[1,3,5],ground:false},
 {id:'potato',name:'Khoai tây',tier:1,minutes:120,xp:40,frames:[1,2,3,5],ground:true},
 {id:'cabbage',name:'Bắp cải',tier:1,minutes:180,xp:40,frames:[1,2,3,5],ground:true},
 {id:'corn',name:'Ngô',tier:1,minutes:240,xp:60,frames:[1,2,3,5],ground:true},
 {id:'tomato',name:'Cà chua',tier:2,minutes:300,xp:50,frames:[1,2,3,5],ground:true},
 {id:'eggplant',name:'Cà tím',tier:2,minutes:360,xp:60,frames:[1,2,3,5],ground:true},
 {id:'pumpkin',name:'Bí ngô',tier:2,minutes:900,xp:90,frames:[1,2,3,4,5],ground:true},
 {id:'strawberry',name:'Dâu tây',tier:2,minutes:600,xp:60,frames:[1,2,3,4,5],ground:true},
 {id:'cucumber',name:'Dưa chuột',tier:2,minutes:480,xp:50,frames:[1,2,3,5],ground:false},
 {id:'chili',name:'Ớt',tier:2,minutes:720,xp:60,frames:[1,2,3,5],ground:false},
 {id:'bell_pepper',name:'Ớt chuông',tier:2,minutes:1080,xp:75,frames:[1,2,3,5],ground:false},
 {id:'sweet_potato',name:'Khoai lang',tier:2,minutes:1440,xp:60,frames:[1,2,3,4,5],ground:false},
 {id:'pineapple',name:'Dứa',tier:3,minutes:2160,xp:120,frames:[1,2,3,4,5],ground:true},
 {id:'watermelon',name:'Dưa hấu',tier:3,minutes:2880,xp:120,frames:[1,2,3,4,5],ground:true},
 {id:'peanut',name:'Đậu phộng',tier:3,minutes:1800,xp:90,frames:[1,2,3,4,5],ground:false},
 {id:'mango',name:'Xoài',tier:3,minutes:4320,xp:150,frames:[1,2,3,4,5],ground:false,orchard:true},
 {id:'apple',name:'Táo',tier:3,minutes:3960,xp:150,frames:[1,2,3,4,5],ground:false,orchard:true},
 {id:'banana',name:'Chuối',tier:3,minutes:3360,xp:140,frames:[1,2,3,4,5],ground:false,orchard:true}
];
export const plantStages: Record<string,number> = Object.fromEntries(plants.map(p=>[p.id,p.frames.length]));
export function plantDefinition(id:string) { return plants.find(p=>p.id===id); }
export const defaults: CatalogItem[] = [
 ...plants.map(p=>({id:p.id,name:p.name,kind:'seed' as const,price:[10,30,60][p.tier-1],grow_seconds:p.minutes*60,xp:p.xp,min_level:p.tier,reduction_seconds:0,active:true})),
 {id:'fertilizer',name:'Phân bón',kind:'fertilizer',price:5,grow_seconds:0,xp:0,min_level:1,reduction_seconds:1800,active:true},
 {id:'gacha_common',name:'Hạt Thường',kind:'gacha',price:10,grow_seconds:0,xp:0,min_level:1,reduction_seconds:0,active:true},
 {id:'gacha_rare',name:'Hạt Hiếm',kind:'gacha',price:30,grow_seconds:0,xp:0,min_level:2,reduction_seconds:0,active:true},
 {id:'gacha_special',name:'Hạt Đặc biệt',kind:'gacha',price:60,grow_seconds:0,xp:0,min_level:3,reduction_seconds:0,active:true}
];
const tierWeights=[[1920,378,56],[960,1050,280],[360,735,1400]];
export const defaultDrops: SeedDrop[] = ['gacha_common','gacha_rare','gacha_special'].flatMap((seed,index)=>plants.map(p=>({seed_id:seed,plant_id:p.id,weight:tierWeights[index][p.tier-1]})));
export const emptyData: GameData = { profile:null,manager:false,plots:[],unlockedSlots:[0,1,2,3],discoveredSeeds:['carrot','rice'],catalog:defaults,drops:defaultDrops,inventory:[],collection:[] };
const levelTitles = [
 'Hạt Mầm Tri Thức', 'Người Gieo Hạt', 'Mầm Non Chăm Chỉ', 'Người Chăm Vườn',
 'Nhà Làm Vườn Tập Sự', 'Người Nuôi Dưỡng Mầm Xanh', 'Nhà Làm Vườn Chăm Chỉ', 'Người Khám Phá Khu Vườn',
 'Người Ươm Mầm Tri Thức', 'Nhà Làm Vườn Tri Thức', 'Người Gặt Hái Kiến Thức', 'Người Chăm Vườn Tài Ba',
 'Nhà Sưu Tầm Hạt Giống', 'Người Nuôi Dưỡng Ước Mơ', 'Nghệ Nhân Vườn Xanh', 'Người Kiến Tạo Khu Vườn',
 'Bậc Thầy Ươm Mầm', 'Người Gìn Giữ Mầm Xanh', 'Bậc Thầy Tri Thức', 'Huyền Thoại Vườn Tri Thức',
];
export function discoveredSeedIds(plots:Pick<Plot,'seed_id'|'source_seed_id'>[]) {
 return Array.from(new Set(['carrot','rice'].concat(plots.filter(p=>p.source_seed_id==='gacha_common'||p.source_seed_id==='gacha_rare'||p.source_seed_id==='gacha_special').map(p=>p.seed_id))));
}
export function levelTitle(level:number) {
 return levelTitles[Math.min(levelTitles.length-1,Math.max(0,Math.floor(level)-1))];
}

export function levelInfo(xp: number) {
 const level = Math.floor((1 + Math.sqrt(1 + 8 * Math.max(0,xp) / 100)) / 2);
 const start = 50 * level * (level - 1);
 return { level, current: xp-start, needed:100*level, progress: Math.min(100,(xp-start)/(100*level)*100) };
}
export function timeLeft(ready: string, now: number): string {
 const seconds = Math.max(0,Math.ceil((Date.parse(ready)-now)/1000));
 if (!seconds) return 'Sẵn sàng thu hoạch';
 const minutes=Math.ceil(seconds/60);
 return minutes>=60 ? Math.floor(minutes/60)+' giờ '+minutes%60+' phút' : minutes+' phút';
}
export function growth(plot: Plot, now: number) {
 const total=plot.growth_seconds>0?plot.growth_seconds*1000:Date.parse(plot.ready_at)-Date.parse(plot.planted_at);
 return total<=0?1:Math.max(0,Math.min(1,1-(Date.parse(plot.ready_at)-now)/total));
}
export function plantArt(id:string,stage=plantStages[id]) {
 const p=plantDefinition(id),frame=p?.frames[Math.max(0,Math.min((stage||1)-1,p.frames.length-1))];
 return p?'farm/plants/'+id+'/stage-'+String(frame).padStart(2,'0'):'farm/plants/carrot/stage-01';
}
export function harvestArt(id:string) { return 'farm/items/'+id+'-harvest'; }
export function plantVisual(plot:Plot,now:number) {
 const amount=growth(plot,now),total=plantStages[plot.seed_id]||3;
 const stage=amount>=1?total:amount<.1?1:Math.min(total-1,2+Math.floor((amount-.1)/.9*(total-2)));
 return {stage,total,art:plantArt(plot.seed_id,stage),label:stage===total?'Đã trưởng thành':(stage===1&&plantDefinition(plot.seed_id)?.orchard?'Cây con':'Giai đoạn '+stage+'/'+total)};
}
export function catalogArt(item:CatalogItem) { return item.kind==='gacha'?'gacha/'+item.id.replace('gacha_',''):item.kind==='seed'?'farm/items/'+item.id+'-packet':'farm/items/sack'; }
export function catalogLabel(item:CatalogItem) { return (item.kind==='seed'?'Hạt ':'')+item.name; }
export function seedOdds(id:string,drops:SeedDrop[],catalog:CatalogItem[]) {
 const available=drops.filter(d=>d.seed_id===id&&catalog.some(c=>c.id===d.plant_id&&c.kind==='seed'&&!c.retired&&c.active&&c.grow_seconds>0));
 const total=available.reduce((sum,d)=>sum+d.weight,0);
 return available.map(d=>({...d,percent:total?100*d.weight/total:0}));
}
export function itemName(id: string, catalog=defaults) { return catalog.find(c=>c.id===id)?.name ?? id; }
export const statusText = { submitted:'Chờ duyệt',returned:'Cần bổ sung',approved:'Hoàn thành' };
