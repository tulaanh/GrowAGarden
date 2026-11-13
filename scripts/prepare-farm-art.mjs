import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'asset-sources','Farming-Game-Assets');
const output=path.join(root,'public','art','farm');
const files=new Map();
async function collect(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())await collect(file);
  else{
   const marker='Cozy_Tropical_Farm_Starter_v0.2'+path.sep;
   const relative=file.split(marker)[1]?.replaceAll('\\','/');
   if(relative){
    if(files.has(relative))throw new Error('Duplicate source: '+relative);
    files.set(relative,file);
   }
  }
 }
}
await collect(source);
const manifest=JSON.parse(await readFile(files.get('manifest.json'),'utf8'));
const metadata={pack:manifest.pack,version:manifest.version,canvas:{width:256,height:384,pivot:[.5,.9375]},plants:{},assets:[]};
for(const asset of manifest.assets){
 if(!['crops','orchard','items'].includes(asset.category))continue;
 const species=asset.crop||asset.species||asset.id.replace(/_stage_\d+$/,'');
 const growth=asset.category==='crops'||asset.category==='orchard';
 const target=growth?'plants/'+species+'/stage-'+String(asset.stage).padStart(2,'0')+'.webp':
  'items/'+species+'-'+(asset.item_type==='harvest'?'harvest':'packet')+'.webp';
 const input=await readFile(files.get(asset.file));
 const destination=path.join(output,target);
 await mkdir(path.dirname(destination),{recursive:true});
 await sharp(input).resize({width:256}).webp({quality:84,alphaQuality:100,effort:5}).toFile(destination);
 metadata.assets.push({id:asset.id,file:'farm/'+target,source:asset.file,sha256:createHash('sha256').update(input).digest('hex')});
 if(growth){
  metadata.plants[species]??={ground_baked:asset.ground_baked,orchard:asset.category==='orchard',render_span:0,stages:[]};
  metadata.plants[species].stages.push(asset.stage);
  if(asset.stage===5){
   const [left,top,right]=asset.visible_bounds;
   metadata.plants[species].render_span=Math.max(720-top,right-left);
  }
 }
}
if(Object.keys(metadata.plants).length!==21||metadata.assets.length!==147)throw new Error('Incomplete farm export.');
await writeFile(path.join(root,'lib','farm-art.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Prepared 105 growth sprites and 42 item icons for 21 species.');
