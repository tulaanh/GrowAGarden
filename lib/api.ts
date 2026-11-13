import { supabase } from './supabase';
import { discoveredSeedIds, emptyData, type GameData } from './game';
export async function rpc(name:string,args:Record<string,unknown>={}) {
 if(!supabase) throw new Error('Chưa kết nối được ứng dụng.');
 const result=await supabase.rpc(name,args);
 if(result.error) throw new Error(result.error.message);
 return result.data;
}
export async function loadGame(userId:string):Promise<GameData> {
 await rpc('garden_initialize');
 const names=['garden_profiles','garden_plots','garden_catalog','garden_inventory','garden_collection','garden_tasks','garden_progress','garden_attempts','garden_reviews','garden_ledger','garden_seed_drops','garden_unlocked_slots'];
 const results=await Promise.all(names.map(name=>supabase!.from(name).select('*')));
 const error=results.find(r=>r.error)?.error;
 if(error)throw new Error('Chưa tải được dữ liệu. Kiểm tra kết nối rồi thử lại.');
 const [people,plots,catalog,inventory,collection,tasks,progress,attempts,reviews,ledger,drops,land]=results.map(r=>r.data||[]);
 return {...emptyData,profile:people.find(p=>p.user_id===userId)||null,manager:await rpc('garden_manager'),people,plots:plots.filter(p=>!p.harvested),discoveredSeeds:discoveredSeedIds(plots),unlockedSlots:[0,1,2,3,...land.filter(l=>l.user_id===userId).map(l=>l.slot)],catalog:catalog.filter(c=>!c.retired),drops,inventory,collection,tasks,progress,attempts,reviews,ledger:ledger.sort((a,b)=>b.created_at.localeCompare(a.created_at))} as GameData;
}
export async function uploadFiles(files:File[],bucket:string,userId:string):Promise<string[]> {
 if(files.length>5)throw new Error('Mỗi lần nộp tối đa 5 tệp.');
 const paths:string[]=[];
 try{
  for(const file of files){
   const allowed=bucket==='garden-task-files'?['image/jpeg','image/png','image/webp','application/pdf']:['image/jpeg','image/png','image/webp','image/heic','image/heif'];
   if(!allowed.includes(file.type)||file.size>10*1024*1024)throw new Error('Tệp cần đúng định dạng và không quá 10 MB.');
   const path=userId+'/'+crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   const {error}=await supabase!.storage.from(bucket).upload(path,file,{contentType:file.type});
   if(error)throw new Error('Chưa tải được tệp. Kiểm tra kết nối rồi thử lại.');
   paths.push(path);
  }
  return paths;
 }catch(e){await cleanupFiles(paths,bucket);throw e;}
}
export async function cleanupFiles(paths:string[],bucket:string) {if(paths.length)await supabase!.storage.from(bucket).remove(paths);}
