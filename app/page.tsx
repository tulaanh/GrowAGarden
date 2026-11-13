'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
import {cleanupFiles,loadGame,rpc,uploadFiles} from '../lib/api';
import {catalogArt,catalogLabel,emptyData,harvestArt,itemName,levelInfo,plantArt,plantDefinition,plantStages,plantVisual,seedOdds,statusText,timeLeft,type GameData,type Task,type CatalogItem} from '../lib/game';
import {Art,DateLabel,Dialog,Empty,FileLinks,FilePicker,Icon,Money,Plant,SeedOdds} from './ui';
import {Admin} from './admin';

type View='garden'|'tasks'|'shop'|'account'|'admin';
export type Run=(job:()=>Promise<void>,message?:string)=>Promise<void>;

export default function Home(){
 const [session,setSession]=useState<Session|null>(null);
 const [ready,setReady]=useState(false),[data,setData]=useState<GameData>(emptyData),[loading,setLoading]=useState(false);
 const [view,setView]=useState<View>('garden'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [taskFilter,setTaskFilter]=useState<'open'|'all'>('open');
 const [slot,setSlot]=useState<number|null>(null),[selectedTask,setSelectedTask]=useState<Task|null>(null);
 const [auth,setAuth]=useState(false),[signup,setSignup]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [files,setFiles]=useState<File[]>([]),[now,setNow]=useState(Date.now());
 const [preview,setPreview]=useState<{url:string;pdf:boolean}|null>(null);
 const activeUser=useRef<string|undefined>(undefined),working=useRef(false);
 activeUser.current=session?.user.id;
 const game=session&&data.profile?.user_id===session.user.id?data:emptyData;
 const lv=levelInfo(game.profile?.xp||0);
 const plot=game.plots.find(p=>p.slot===slot);
 const visual=plot?plantVisual(plot,now):null;
 const inventory=(id:string)=>game.inventory.find(i=>i.item_id===id)?.quantity||0;
 const pending=game.tasks.filter(t=>t.status==='published'&&!game.progress.some(p=>p.task_id===t.id&&p.user_id===session?.user.id&&p.status==='approved')).length;
 const visibleTasks=game.tasks.filter(t=>(t.status==='published'||game.progress.some(p=>p.task_id===t.id&&p.user_id===session?.user.id))&&(taskFilter==='all'||!game.progress.some(p=>p.task_id===t.id&&p.user_id===session?.user.id&&p.status==='approved')));
 const refresh=useCallback(async()=>{
  const id=session?.user.id;if(!id)return;
  const next=await loadGame(id);if(activeUser.current===id)setData(next);
 },[session?.user.id]);
 useEffect(()=>{
  if(!supabase){setError('Chưa kết nối được dịch vụ.');setReady(true);return;}
  supabase.auth.getSession().then(({data,error})=>{if(error)setError('Chưa khôi phục được đăng nhập.');setSession(data.session);setReady(true);});
  const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(!s){setData(emptyData);setSlot(null);setSelectedTask(null);setView('garden');}});
  return()=>l.subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(!session)return;setLoading(true);refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[session?.user.id,refresh]);
 useEffect(()=>{
  const timer=setInterval(()=>setNow(Date.now()),1000);
  const poll=setInterval(()=>{if(document.visibilityState==='visible'&&session)refresh().catch(()=>{});},30000);
  const focus=()=>{if(session)refresh().catch(()=>{});};window.addEventListener('focus',focus);
  return()=>{clearInterval(timer);clearInterval(poll);window.removeEventListener('focus',focus);};
 },[session,refresh]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{window.scrollTo(0,0);},[view]);
 const run:Run=async(job,message)=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');
  try{await job();await refresh();if(message)setNotice(message);}
  catch(e){setError(e instanceof Error?e.message:'Có lỗi xảy ra. Hãy thử lại.');}
  finally{working.current=false;setBusy(false);}
 };
 function needLogin(){if(!session){setAuth(true);return true;}return false;}
 async function openFile(path:string,bucket:string){
  try{const r=await supabase!.storage.from(bucket).createSignedUrl(path,300);if(r.error)throw r.error;setPreview({url:r.data.signedUrl,pdf:path.toLowerCase().endsWith('.pdf')});}
  catch{setError('Chưa mở được tệp. Hãy thử lại.');}
 }
 async function authenticate(e:React.FormEvent){
  e.preventDefault();
  await run(async()=>{
   const response=signup?await supabase!.auth.signUp({email:email.trim(),password}):await supabase!.auth.signInWithPassword({email:email.trim(),password});
   if(response.error)throw new Error(response.error.message==='Invalid login credentials'?'Email hoặc mật khẩu chưa đúng.':response.error.message);
   if(!response.data.session)throw new Error('Chưa đăng nhập được. Vui lòng kiểm tra cấu hình tài khoản.');
   setAuth(false);setPassword('');setNotice(signup?'Tạo tài khoản thành công. Cùng bắt đầu nhé!':'Chào mừng bạn trở lại!');
  });
 }
 async function submitTask(){
  if(!selectedTask||!session||!files.length)return;
  await run(async()=>{
   const paths=await uploadFiles(files,'garden-homework',session.user.id);
   try{await rpc('garden_submit_task',{p_task:selectedTask.id,p_files:paths});}catch(e){await cleanupFiles(paths,'garden-homework');throw e;}
   setSelectedTask(null);setFiles([]);
  },'Đã nộp bài. Bạn sẽ nhận thưởng khi được duyệt.');
 }
 function chooseTask(t:Task){if(needLogin())return;setFiles([]);setSelectedTask(t);setError('');}
 function navigate(next:View){setView(next);setSlot(null);setError('');}
 const positions=[[50,27],[31,38],[69,38],[12,49],[50,49],[88,49],[31,61],[69,61],[50,73]];
 const ownProgress=selectedTask?game.progress.find(p=>p.task_id===selectedTask.id&&p.user_id===session?.user.id):undefined;
 return <div className="world">
  <img className="landscape" src="/art/landscape.webp" alt="" width="1024" height="1536" fetchPriority="high"/>
  <header className="game-header">
   <div className="title-sign"><Art name="sign"/><h1>VƯỜN BÀI TẬP</h1></div>
   <div className="hud">
    <button className="player" onClick={()=>navigate('account')} aria-label="Mở tài khoản"><span className="avatar"><Icon name="account"/></span><span><strong>{game.profile?.display_name||'Người làm vườn'}</strong><span className="xp-bar"><span style={{width:lv.progress+'%'}}/></span><small>Cấp {lv.level} · {lv.current}/{lv.needed} XP</small></span></button>
    <button className="wallet" onClick={()=>navigate('account')} aria-label={'Ví '+(game.profile?.coins||0)+' Đồng tri thức'}><Money amount={game.profile?.coins||0}/></button>
   </div>
  </header>
  <main className={'main-content view-'+view}>
   {!ready||loading?<div className="loading" role="status">Đang chuẩn bị khu vườn...</div>:null}
   {error&&<div className="alert" role="alert"><span>{error}</span><button onClick={()=>{setError('');if(session)refresh().catch(e=>setError(e.message));}}>Thử lại</button><button aria-label="Đóng thông báo" onClick={()=>setError('')}>×</button></div>}
   {notice&&<div className="toast" role="status">{notice}</div>}
   {view==='garden'&&<>
    <div className="garden-layout">
     <section className="garden-stage" aria-label="Khu vườn chín ô đất">
      <Art name="island" className="island"/>
      {positions.map(([x,y],i)=>{
       const p=game.plots.find(p=>p.slot===i),grown=p&&Date.parse(p.ready_at)<=now;
       return <div className={'plot-position '+(p?'has-plant':'')} style={{left:x+'%',top:y+'%',zIndex:Math.round(y)}} key={i}>
        <button className={'plot '+(grown?'grown ':'')+(p&&plantDefinition(p.seed_id)?.ground?'has-baked-ground':'')} onClick={()=>{if(!needLogin()){setSlot(i);setError('');}}} aria-label={'Ô '+(i+1)+(p?': '+itemName(p.seed_id,game.catalog)+', '+timeLeft(p.ready_at,now):': đất trống')}>
         <span className="soil"/>{p?<Plant plot={p} now={now}/>:<span className="plot-plus">+</span>}
         {grown&&<span className="harvest-tag">Thu hoạch</span>}
         <span className="plot-number">{i+1}</span>
        </button>
       </div>;
      })}
     </section>
     <aside className="garden-info parchment"><p className="kicker">GÓC VƯỜN CỦA BẠN</p><h2>Gieo mầm tri thức</h2><p>Làm bài mỗi ngày, nhận Đồng tri thức và vun đắp khu vườn riêng.</p><div className="info-row"><span>Cây đang trồng</span><strong>{game.plots.length}/9</strong></div><div className="info-row"><span>Nhiệm vụ cần làm</span><strong>{pending}</strong></div><button className="secondary" onClick={()=>navigate('shop')}>Ghé cửa hàng hạt giống</button>{!session&&<button className="primary" onClick={()=>setAuth(true)}>Đăng nhập để chơi</button>}</aside>
    </div>
   </>}
   {view==='tasks'&&<section className="parchment content-panel"><div className="panel-heading"><div><p className="kicker">MỖI BÀI LÀ MỘT BƯỚC TIẾN</p><h2>Nhiệm vụ</h2></div>{game.manager&&<button className="secondary" onClick={()=>navigate('admin')}>Quản lý bài tập</button>}</div>
    {session&&<div className="tabs"><button className={taskFilter==='open'?'active':''} onClick={()=>setTaskFilter('open')}>Cần hoàn thành</button><button className={taskFilter==='all'?'active':''} onClick={()=>setTaskFilter('all')}>Tất cả</button></div>}
    {!session?<Empty title="Bắt đầu hành trình học tập">Đăng nhập để xem bài tập và lưu thành quả của bạn.<button className="primary" onClick={()=>setAuth(true)}>Đăng nhập</button></Empty>:
     !visibleTasks.length?<Empty title={taskFilter==='open'?'Chưa có nhiệm vụ cần hoàn thành':'Chưa có nhiệm vụ'}>Bài tập mới sẽ xuất hiện ở đây khi được giao. Bạn có thể xem bài đã xong trong mục Tất cả.</Empty>:
     <div className="task-list">{visibleTasks.map(t=>{
      const p=game.progress.find(p=>p.task_id===t.id&&p.user_id===session.user.id);
      return <button className="task-card" onClick={e=>{e.currentTarget.focus();chooseTask(t);}} key={t.id}><span className="task-symbol"><Icon name="tasks"/></span><span className="task-content"><strong>{t.title}</strong><small>Hạn nộp: <DateLabel value={t.due_at}/></small><span className={'status '+(p?.status||'new')}>{p?statusText[p.status]:'Chưa nộp'}{t.status==='hidden'?' · Đã ẩn':''}</span></span><span className="reward">+{p?.status==='approved'?p.reward_snapshot:t.reward}<small>Đồng tri thức</small></span></button>;
     })}</div>}
   </section>}
   {view==='shop'&&<section className="parchment content-panel"><div className="panel-heading"><div><p className="kicker">MỘT HẠT NHỎ, MỘT KHU VƯỜN LỚN</p><h2>Cửa hàng</h2></div><Money amount={game.profile?.coins||0}/></div><p className="panel-description">Mua hạt gacha, gieo vào vườn để khám phá cây ngẫu nhiên. Mỗi loại hạt có tỷ lệ riêng; phân bón giúp cây lớn nhanh hơn.</p><div className="shop-grid">{game.catalog.filter(c=>c.active&&c.kind!=='seed').map(c=><ShopCard key={c.id} item={c} data={game} level={lv.level} owned={inventory(c.id)} balance={game.profile?.coins||0} busy={busy} guest={!session} onBuy={quantity=>{if(!needLogin())run(async()=>{await rpc('garden_buy',{p_item:c.id,p_quantity:quantity,p_request:crypto.randomUUID()});},'Đã thêm vật phẩm vào kho.');}}/>)}</div><p className="helper">Đồng tri thức nhận từ bài tập được duyệt. Thu hoạch cho nông sản và XP.</p></section>}
   {view==='account'&&<section className="parchment content-panel"><p className="kicker">THÀNH QUẢ CỦA RIÊNG BẠN</p><h2>Tài khoản & bộ sưu tập</h2>{!session?<Empty title="Khu vườn đang chờ bạn">Tạo tài khoản để nhận nhiệm vụ, mua hạt giống và lưu khu vườn.<button className="primary" onClick={()=>{setSignup(true);setAuth(true);}}>Tạo tài khoản</button><button className="secondary" onClick={()=>{setSignup(false);setAuth(true);}}>Đăng nhập</button></Empty>:<>
    <div className="account-summary"><div><strong>{game.profile?.display_name}</strong><p className="email">{session.user.email}</p><span>Cấp {lv.level} · {game.profile?.xp||0} XP tích lũy</span></div><Money amount={game.profile?.coins||0}/></div>
    <div className="button-row">{game.manager&&<button className="primary" onClick={()=>navigate('admin')}>Quản lý nhiệm vụ & cửa hàng</button>}<button className="secondary" disabled={busy} onClick={()=>run(async()=>{const result=await supabase!.auth.signOut();if(result.error)throw result.error;},'Đã đăng xuất.')}>Đăng xuất</button></div>
    <h3>Nông sản sưu tầm</h3><div className="collection">{game.catalog.filter(c=>c.kind==='seed').map(c=><div className={'collection-item '+(!game.collection.some(x=>x.seed_id===c.id)?'uncollected':'')} key={c.id}><Art name={harvestArt(c.id)}/><strong>{c.name}</strong><span>{game.collection.find(x=>x.seed_id===c.id)?.quantity||0} nông sản</span><span>{plantStages[c.id]} giai đoạn phát triển</span></div>)}</div>
    <h3>Kho vật phẩm</h3><div className="inventory-list">{game.catalog.filter(c=>c.kind!=='seed'||inventory(c.id)>0).map(c=><div className="info-row" key={c.id}><span className="inventory-name">{c.kind!=='fertilizer'&&<Art name={catalogArt(c)}/>}<span>{catalogLabel(c)}</span></span><strong>{inventory(c.id)}</strong></div>)}</div>
    <h3>Lịch sử Đồng tri thức</h3>{!game.ledger.length?<p className="helper">Các khoản thưởng và mua hàng sẽ xuất hiện ở đây.</p>:<div className="ledger">{game.ledger.map(l=><div className="ledger-row" key={l.id}><span>{l.note||'Thưởng thêm'}<small><DateLabel value={l.created_at}/></small></span><strong className={l.amount>0?'positive':''}>{l.amount>0?'+':''}{l.amount}</strong></div>)}</div>}
   </>}</section>}
   {view==='admin'&&game.manager&&session&&<Admin data={game} userId={session.user.id} busy={busy} run={run} openFile={openFile} error={error}/>}
  </main>
  <nav className="bottom-nav" aria-label="Điều hướng chính">{([['garden','Khu vườn'],['tasks','Nhiệm vụ'],['shop','Cửa hàng'],['account','Tài khoản']] as [View,string][]).map(([id,label])=><button className={view===id?'active':''} key={id} onClick={()=>navigate(id)} aria-current={view===id?'page':undefined}><Icon name={id}/><span>{label}</span></button>)}</nav>
  {auth&&<Dialog title={signup?'Tạo tài khoản':'Đăng nhập'} onClose={()=>setAuth(false)}><p>Tạo một khu vườn của riêng bạn, bắt đầu từ bài tập hôm nay.</p><form onSubmit={authenticate}><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="password">Mật khẩu</label><input id="password" type="password" autoComplete={signup?'new-password':'current-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<p className="inline-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Đang xử lý...':signup?'Tạo tài khoản & vào vườn':'Đăng nhập'}</button></form><button className="link-button" onClick={()=>{setSignup(!signup);setError('');}}>{signup?'Đã có tài khoản? Đăng nhập':'Chưa có tài khoản? Đăng ký'}</button></Dialog>}
  {slot!==null&&session&&<Dialog title={plot?itemName(plot.seed_id,game.catalog):'Gieo hạt vào ô '+(slot+1)} onClose={()=>setSlot(null)}>
   {plot&&visual?<><Art name={visual.art} className="detail-plant"/><p className="center growth-label">{visual.label}</p><div className="growth-track" aria-label="Các giai đoạn phát triển">{Array.from({length:visual.total},(_,i)=>i+1).map(stage=><span className={stage<=visual.stage?'reached':''} key={stage} aria-current={stage===visual.stage?'step':undefined}><Art name={plantArt(plot.seed_id,stage)}/><small>{stage===1?(plantDefinition(plot.seed_id)?.orchard?'Cây con':'Mới gieo'):stage===visual.total?'Chín':stage}</small></span>)}</div>{plot.source_seed_id&&<p className="center helper">Gieo từ {itemName(plot.source_seed_id,game.catalog)}</p>}<p className="center">{timeLeft(plot.ready_at,now)}</p><p className="center helper">Thu hoạch nhận {plot.xp_reward} XP và 1 nông sản</p>{Date.parse(plot.ready_at)<=now?<button className="primary" disabled={busy} onClick={()=>run(async()=>{await rpc('garden_harvest',{p_plot:plot.id});setSlot(null);},'Đã thu hoạch nông sản và nhận XP!')}>Thu hoạch</button>:<><button className="primary" disabled={busy||inventory('fertilizer')===0} onClick={()=>run(async()=>{await rpc('garden_fertilize',{p_plot:plot.id});},'Đã bón phân cho cây.')}>Bón phân · còn {inventory('fertilizer')}</button><p className="helper">Giảm tối đa {Math.round((game.catalog.find(c=>c.id==='fertilizer')?.reduction_seconds||1800)/60)} phút chờ cho mỗi phần phân bón.</p><button className="secondary" onClick={()=>{setSlot(null);navigate('shop');}}>Mua phân bón</button></>}</>:
    <><p>Chọn hạt trong kho để gieo. Hạt gacha sẽ trở thành một cây ngẫu nhiên ngay khi gieo.</p><div className="seed-options">{game.catalog.filter(c=>c.kind==='gacha'||(c.kind==='seed'&&inventory(c.id)>0)).map(c=><div key={c.id}><button className="seed-option" disabled={busy||inventory(c.id)===0||(c.kind==='gacha'&&!seedOdds(c.id,game.drops,game.catalog).length)} onClick={()=>run(async()=>{await rpc('garden_plant',{p_slot:slot,p_seed:c.id});},c.kind==='gacha'?'Đã gieo hạt! Cây bạn nhận được đang ở ô đất này.':'Đã gieo hạt giống.')}><Art name={catalogArt(c)}/><span><strong>{catalogLabel(c)}</strong><small>{c.kind==='gacha'?'Khám phá cây khi gieo':Math.round(c.grow_seconds/60)+' phút · '+c.xp+' XP'}</small></span><b>×{inventory(c.id)}</b></button>{c.kind==='gacha'&&<SeedOdds id={c.id} data={game}/>}</div>)}</div><button className="secondary" onClick={()=>{setSlot(null);navigate('shop');}}>Mua thêm hạt giống</button></>}
   {error&&<p className="inline-error" role="alert">{error}</p>}
  </Dialog>}
  {selectedTask&&session&&<Dialog title={selectedTask.title} drawer onClose={()=>setSelectedTask(null)}><div className="task-meta"><Money amount={ownProgress?.status==='approved'?ownProgress.reward_snapshot:selectedTask.reward}/><span>Hạn: <DateLabel value={selectedTask.due_at}/></span></div><p className="task-body">{selectedTask.body}</p><FileLinks files={selectedTask.files} onOpen={p=>openFile(p,'garden-task-files')}/>{ownProgress&&<><p className={'status '+ownProgress.status}>{statusText[ownProgress.status]}{selectedTask.due_at&&Date.parse(ownProgress.submitted_at)>Date.parse(selectedTask.due_at)?' · Nộp trễ':''}</p>{game.reviews.filter(r=>r.progress_id===ownProgress.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(r=><div className="review-note" key={r.id}><strong>{r.action==='bonus'?'Thưởng thêm +'+r.amount+' Đồng tri thức':r.action==='approved'?'Đã duyệt hoàn thành':'Yêu cầu bổ sung'}</strong><p>{r.note||'Không có nhận xét.'}</p><small><DateLabel value={r.created_at}/></small></div>)}{game.attempts.filter(a=>a.progress_id===ownProgress.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(a=><details key={a.id}><summary>Bài đã nộp · <DateLabel value={a.created_at}/></summary><FileLinks files={a.files} onOpen={p=>openFile(p,'garden-homework')}/></details>)}</>}
    {selectedTask.status==='published'&&(!ownProgress||ownProgress.status==='returned')?<><FilePicker id="submission" files={files} onChange={setFiles}/><button className="primary" disabled={busy||files.length===0} onClick={submitTask}>{busy?'Đang nộp bài...':ownProgress?'Nộp lại bài':'Nộp bài để chờ duyệt'}</button></>:<p className="helper">{ownProgress?.status==='approved'?'Bạn đã nhận thưởng cho nhiệm vụ này.':ownProgress?.status==='submitted'?'Bài của bạn đang chờ quản lý kiểm tra.':'Nhiệm vụ đã ẩn, hiện không nhận bài mới.'}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}
  </Dialog>}
  {preview&&<Dialog title="Tệp đính kèm" onClose={()=>setPreview(null)}>{preview.pdf?<a className="primary file-link" href={preview.url} target="_blank" rel="noopener noreferrer">Mở tài liệu PDF</a>:<img className="preview-image" src={preview.url} alt="Nội dung tệp đính kèm" width="1000" height="1000"/>}</Dialog>}
 </div>;
}

function ShopCard({item:c,data,level,owned,balance,busy,guest,onBuy}:{item:CatalogItem;data:GameData;level:number;owned:number;balance:number;busy:boolean;guest:boolean;onBuy:(q:number)=>void}){
 const [quantity,setQuantity]=useState(1),locked=level<c.min_level;
 const validQuantity=Number.isInteger(quantity)&&quantity>=1&&quantity<=99;
 const total=validQuantity?c.price*quantity:0;
 const missing=Math.max(0,total-balance);
 const insufficient=!guest&&!locked&&validQuantity&&missing>0;
 const unavailable=c.kind==='gacha'&&!seedOdds(c.id,data.drops,data.catalog).length;
 const label=busy?'Đang xử lý...':unavailable?'Tạm ngừng bán':guest?'Đăng nhập để mua':locked?'Mở ở cấp '+c.min_level:!validQuantity?'Chọn số lượng 1–99':insufficient?'Thiếu '+missing.toLocaleString('vi-VN')+' ĐTT':'Mua · '+total.toLocaleString('vi-VN')+' ĐTT';
 return <article className="shop-card">
  <div className="shop-art">{c.kind!=='fertilizer'?<Art name={catalogArt(c)}/>:<span className="fertilizer-art"><Icon name="fertilizer"/></span>}</div>
  <h3>{catalogLabel(c)}</h3>
  <p>{c.kind==='gacha'?'Gieo 1 hạt → nhận 1 cây ngẫu nhiên':'Giảm tối đa '+Math.round(c.reduction_seconds/60)+' phút'}</p>
  {c.kind==='gacha'&&<SeedOdds id={c.id} data={data}/>}
  <p className="item-price">Giá: {c.price.toLocaleString('vi-VN')} Đồng tri thức</p>
  <span className="owned">Trong kho: {owned}</span>
  <label htmlFor={'quantity-'+c.id}>Số lượng</label>
  <input id={'quantity-'+c.id} type="number" min="1" max="99" step="1" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/>
  <button className="primary" disabled={busy||unavailable||!validQuantity||(!guest&&(locked||missing>0))} onClick={()=>onBuy(quantity)}>{label}</button>
 </article>;
}
