create schema garden_private;
revoke all on schema garden_private from public;
grant usage on schema garden_private to authenticated;
create table garden_private.managers(user_id uuid primary key references auth.users(id) on delete cascade);
create function garden_private.is_manager() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from garden_private.managers where user_id=auth.uid());
$$;
create function public.garden_manager() returns boolean language sql stable security invoker set search_path='' as $$ select garden_private.is_manager(); $$;
alter table public.garden_profiles add column xp integer not null default 0 check(xp>=0);
alter table public.garden_profiles add column display_name text not null default 'Người làm vườn';
create function garden_private.ensure_profile() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 insert into public.garden_profiles(user_id,display_name) select id,split_part(email,'@',1) from auth.users where id=u on conflict do nothing;
 if not found and not exists(select 1 from public.garden_profiles where user_id=u) then raise exception 'Tài khoản không còn tồn tại.'; end if;
 return u;
end $$;
create function public.garden_initialize() returns void language sql security invoker set search_path='' as $$ select garden_private.ensure_profile(); $$;
create function garden_private.require_manager() returns void language plpgsql security definer set search_path='' as $$
begin if not garden_private.is_manager() then raise exception 'Chỉ quản lý được thực hiện thao tác này.'; end if; end $$;
create policy "manager profiles" on public.garden_profiles for select to authenticated using(garden_private.is_manager());

create table public.garden_catalog(
 id text primary key, name text not null, kind text not null check(kind in ('seed','fertilizer')),
 price integer not null check(price>=0), grow_seconds integer not null default 0 check(grow_seconds>=0),
 xp integer not null default 0 check(xp>=0), min_level integer not null default 1 check(min_level>=1),
 reduction_seconds integer not null default 0 check(reduction_seconds>=0), active boolean not null default true
);
insert into public.garden_catalog(id,name,kind,price,grow_seconds,xp,min_level,reduction_seconds) values
 ('carrot','Cà rốt','seed',10,1800,20,1,0),('sunflower','Hướng dương','seed',30,7200,60,2,0),
 ('lotus','Sen vàng','seed',60,21600,150,3,0),('fertilizer','Phân bón','fertilizer',5,0,0,1,1800);
create table public.garden_inventory(user_id uuid references auth.users(id) on delete cascade,item_id text references public.garden_catalog(id),quantity integer not null default 0 check(quantity>=0),primary key(user_id,item_id));
create table public.garden_collection(user_id uuid references auth.users(id) on delete cascade,seed_id text references public.garden_catalog(id),quantity integer not null default 0 check(quantity>=0),primary key(user_id,seed_id));
create table public.garden_ledger(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 amount integer not null,kind text not null,reference text not null,note text not null default '',created_at timestamptz not null default now(),unique(user_id,kind,reference)
);
create index on public.garden_ledger(user_id,created_at desc);
create table public.garden_tasks(
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 180),
 body text not null default '',due_at timestamptz, reward integer not null default 20 check(reward>=0),
 status text not null default 'draft' check(status in ('draft','published','hidden')),
 files text[] not null default '{}',created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.garden_progress(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null references public.garden_tasks(id),status text not null check(status in ('submitted','returned','approved')),
 reward_snapshot integer not null,submitted_at timestamptz not null default now(),approved_at timestamptz,
 bonus_given boolean not null default false,unique(user_id,task_id)
);
create index on public.garden_progress(task_id,status);
create table public.garden_attempts(
 id uuid primary key default gen_random_uuid(),progress_id uuid not null references public.garden_progress(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,files text[] not null,created_at timestamptz not null default now()
);
create index on public.garden_attempts(progress_id,created_at desc);
create table public.garden_reviews(
 id uuid primary key default gen_random_uuid(),progress_id uuid not null references public.garden_progress(id) on delete cascade,
 action text not null check(action in ('approved','returned','bonus')),note text not null default '',
 amount integer not null default 0,reviewer uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index on public.garden_reviews(progress_id,created_at desc);
alter table public.garden_plots rename column assignment_id to seed_id;
alter table public.garden_plots add column planted_at timestamptz not null default now();
alter table public.garden_plots add column ready_at timestamptz not null default now();
alter table public.garden_plots add column xp_reward integer not null default 20 check(xp_reward>=0);
update public.garden_plots p set ready_at=case when score is not null then now() else now()+make_interval(secs=>c.grow_seconds) end,xp_reward=c.xp from public.garden_catalog c where c.id=p.seed_id;
alter table public.garden_plots add constraint garden_plot_seed_fk foreign key(seed_id) references public.garden_catalog(id);
drop function public.garden_plant(integer,text);
drop function public.garden_submit(uuid,text);
drop function public.garden_grade(uuid,numeric);
drop function public.garden_harvest(uuid);

alter table public.garden_catalog enable row level security;
alter table public.garden_inventory enable row level security;
alter table public.garden_collection enable row level security;
alter table public.garden_ledger enable row level security;
alter table public.garden_tasks enable row level security;
alter table public.garden_progress enable row level security;
alter table public.garden_attempts enable row level security;
alter table public.garden_reviews enable row level security;
create policy "catalog read" on public.garden_catalog for select to authenticated using(true);
create policy "inventory own" on public.garden_inventory for select to authenticated using(user_id=(select auth.uid()));
create policy "collection own" on public.garden_collection for select to authenticated using(user_id=(select auth.uid()));
create policy "ledger own" on public.garden_ledger for select to authenticated using(user_id=(select auth.uid()));
create policy "tasks read" on public.garden_tasks for select to authenticated using(status='published' or garden_private.is_manager() or exists(select 1 from public.garden_progress p where p.task_id=garden_tasks.id and p.user_id=(select auth.uid())));
create policy "progress read" on public.garden_progress for select to authenticated using(user_id=(select auth.uid()) or garden_private.is_manager());
create policy "attempt read" on public.garden_attempts for select to authenticated using(user_id=(select auth.uid()) or garden_private.is_manager());
create policy "review read" on public.garden_reviews for select to authenticated using(garden_private.is_manager() or exists(select 1 from public.garden_progress p where p.id=progress_id and p.user_id=(select auth.uid())));
revoke all on public.garden_catalog,public.garden_inventory,public.garden_collection,public.garden_ledger,public.garden_tasks,public.garden_progress,public.garden_attempts,public.garden_reviews from anon,authenticated;
grant select on public.garden_catalog,public.garden_inventory,public.garden_collection,public.garden_ledger,public.garden_tasks,public.garden_progress,public.garden_attempts,public.garden_reviews to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('garden-task-files','garden-task-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "task upload manager" on storage.objects for insert to authenticated with check(bucket_id='garden-task-files' and garden_private.is_manager() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "task file read" on storage.objects for select to authenticated using(bucket_id='garden-task-files' and (garden_private.is_manager() or exists(select 1 from public.garden_tasks t where name=any(t.files))));
create policy "task orphan delete" on storage.objects for delete to authenticated using(bucket_id='garden-task-files' and garden_private.is_manager() and not exists(select 1 from public.garden_tasks t where name=any(t.files)));
create policy "manager homework read" on storage.objects for select to authenticated using(bucket_id='garden-homework' and garden_private.is_manager());
drop policy "garden delete own" on storage.objects;
create policy "homework orphan delete" on storage.objects for delete to authenticated using(bucket_id='garden-homework' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.garden_attempts a where name=any(a.files)));

create function garden_private.valid_files(paths text[],bucket text) returns boolean language sql stable security definer set search_path='' as $$
select coalesce(cardinality(paths) between 1 and 5 and not exists(select 1 from unnest(paths) p where p is null or split_part(p,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id=bucket and o.name=p and o.owner_id=auth.uid()::text)),false);
$$;
create function garden_private.buy(item text,qty integer,request uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); p public.garden_profiles%rowtype;c public.garden_catalog%rowtype;lv integer;
begin
 select * into p from public.garden_profiles where user_id=u for update;
 if request is null or qty is null or qty not between 1 and 99 then raise exception 'Số lượng không hợp lệ.'; end if;
 if exists(select 1 from public.garden_ledger where user_id=u and kind='purchase' and reference=request::text) then return; end if;
 select * into c from public.garden_catalog where id=item and active;
 if not found then raise exception 'Vật phẩm không còn bán.'; end if;
 lv:=floor((1+sqrt(1+8*p.xp/100.0))/2);
 if lv<c.min_level then raise exception 'Bạn chưa đủ cấp độ.'; end if;
 if p.coins::bigint<c.price::bigint*qty then raise exception 'Chưa đủ Đồng tri thức.'; end if;
 update public.garden_profiles set coins=coins-c.price*qty where user_id=u;
 insert into public.garden_inventory values(u,item,qty) on conflict(user_id,item_id) do update set quantity=public.garden_inventory.quantity+excluded.quantity;
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(u,-c.price*qty,'purchase',request::text,'Mua '||qty||' '||c.name);
end $$;
create function public.garden_buy(p_item text,p_quantity integer,p_request uuid) returns void language sql security invoker set search_path='' as $$ select garden_private.buy(p_item,p_quantity,p_request); $$;
create function garden_private.plant(slot_no integer,seed text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); c public.garden_catalog%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 if slot_no is null or slot_no not between 0 and 8 then raise exception 'Ô đất không hợp lệ.'; end if;
 select * into c from public.garden_catalog where id=seed and kind='seed';
 if not found then raise exception 'Hạt giống không hợp lệ.'; end if;
 if exists(select 1 from public.garden_plots where user_id=u and slot=slot_no and not harvested) then raise exception 'Ô này đã có cây.'; end if;
 update public.garden_inventory set quantity=quantity-1 where user_id=u and item_id=seed and quantity>0;
 if not found then raise exception 'Bạn chưa có hạt giống này.'; end if;
 insert into public.garden_plots(user_id,slot,seed_id,ready_at,xp_reward) values(u,slot_no,seed,now()+make_interval(secs=>c.grow_seconds),c.xp);
end $$;
create function public.garden_plant(p_slot integer,p_seed text) returns void language sql security invoker set search_path='' as $$ select garden_private.plant(p_slot,p_seed); $$;
create function garden_private.fertilize(plot uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); p public.garden_plots%rowtype;seconds integer;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=now() then raise exception 'Cây không cần bón phân lúc này.'; end if;
 select reduction_seconds into seconds from public.garden_catalog where id='fertilizer';
 update public.garden_inventory set quantity=quantity-1 where user_id=u and item_id='fertilizer' and quantity>0;
 if not found then raise exception 'Bạn chưa có phân bón.'; end if;
 update public.garden_plots set ready_at=greatest(now(),ready_at-make_interval(secs=>seconds)) where id=plot;
end $$;
create function public.garden_fertilize(p_plot uuid) returns void language sql security invoker set search_path='' as $$ select garden_private.fertilize(p_plot); $$;
create function garden_private.harvest(plot uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile();p public.garden_plots%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at>now() then raise exception 'Cây chưa sẵn sàng thu hoạch.'; end if;
 update public.garden_plots set harvested=true where id=plot;
 update public.garden_profiles set xp=xp+p.xp_reward where user_id=u;
 insert into public.garden_collection values(u,p.seed_id,1) on conflict(user_id,seed_id) do update set quantity=public.garden_collection.quantity+1;
end $$;
create function public.garden_harvest(p_plot uuid) returns void language sql security invoker set search_path='' as $$ select garden_private.harvest(p_plot); $$;

create function garden_private.save_task(task uuid,title text,body text,due timestamptz,reward integer,status text,files text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform garden_private.require_manager();
 if title is null or length(trim(title)) not between 1 and 180 or reward is null or reward not between 0 and 100000 or status not in ('draft','published','hidden') or cardinality(files)>5 then raise exception 'Thông tin nhiệm vụ không hợp lệ.'; end if;
 if cardinality(files)>0 and exists(select 1 from unnest(files) f where not exists(select 1 from storage.objects o where o.bucket_id='garden-task-files' and o.name=f)) then raise exception 'Tệp đính kèm không tồn tại.'; end if;
 if task is null then
 insert into public.garden_tasks(title,body,due_at,reward,status,files,created_by) values(trim(title),coalesce(body,''),due,reward,status,coalesce(files,'{}'),auth.uid()) returning id into result;
 else
 update public.garden_tasks t set title=trim(save_task.title),body=coalesce(save_task.body,''),due_at=due,reward=save_task.reward,status=save_task.status,files=coalesce(save_task.files,'{}'),updated_at=now() where t.id=task returning id into result;
 if not found then raise exception 'Không tìm thấy nhiệm vụ.'; end if;
 end if;
 return result;
end $$;
create function public.garden_save_task(p_id uuid,p_title text,p_body text,p_due timestamptz,p_reward integer,p_status text,p_files text[]) returns uuid language sql security invoker set search_path='' as $$ select garden_private.save_task(p_id,p_title,p_body,p_due,p_reward,p_status,p_files); $$;
create function garden_private.submit_task(task uuid,files text[]) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile();t public.garden_tasks%rowtype;p public.garden_progress%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 select * into t from public.garden_tasks where id=task and status='published';
 if not found then raise exception 'Nhiệm vụ chưa mở hoặc đã ẩn.'; end if;
 if not garden_private.valid_files(files,'garden-homework') then raise exception 'Hãy nộp từ 1 đến 5 ảnh bài làm hợp lệ.'; end if;
 insert into public.garden_progress(user_id,task_id,status,reward_snapshot) values(u,task,'returned',t.reward) on conflict(user_id,task_id) do nothing;
 select * into p from public.garden_progress where user_id=u and task_id=task for update;
 if p.status in ('submitted','approved') then raise exception 'Bài này đã nộp hoặc đã hoàn thành.'; end if;
 update public.garden_progress set status='submitted',submitted_at=now(),reward_snapshot=t.reward where id=p.id;
 insert into public.garden_attempts(progress_id,user_id,files) values(p.id,u,files);
end $$;
create function public.garden_submit_task(p_task uuid,p_files text[]) returns void language sql security invoker set search_path='' as $$ select garden_private.submit_task(p_task,p_files); $$;
create function garden_private.review(progress uuid,accept boolean,note text,bonus integer) returns void language plpgsql security definer set search_path='' as $$
declare p public.garden_progress%rowtype;
begin
 perform garden_private.require_manager();
 if bonus is null or bonus not between 0 and 100000 then raise exception 'Thưởng thêm không hợp lệ.'; end if;
 select * into p from public.garden_progress where id=progress;
 if not found then raise exception 'Không tìm thấy bài nộp.'; end if;
 perform 1 from public.garden_profiles where user_id=p.user_id for update;
 select * into p from public.garden_progress where id=progress for update;
 if p.status<>'submitted' then raise exception 'Bài này không đang chờ duyệt.'; end if;
 if accept then
 update public.garden_progress set status='approved',approved_at=now(),bonus_given=(bonus>0) where id=progress;
 update public.garden_profiles set coins=coins+p.reward_snapshot+bonus where user_id=p.user_id;
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(p.user_id,p.reward_snapshot,'task',progress::text,'Hoàn thành nhiệm vụ');
 insert into public.garden_reviews(progress_id,action,note,amount,reviewer) values(progress,'approved',coalesce(note,''),p.reward_snapshot,auth.uid());
 if bonus>0 then
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(p.user_id,bonus,'bonus',progress::text,coalesce(note,''));
 insert into public.garden_reviews(progress_id,action,note,amount,reviewer) values(progress,'bonus',coalesce(note,''),bonus,auth.uid());
 end if;
 else
 update public.garden_progress set status='returned' where id=progress;
 insert into public.garden_reviews(progress_id,action,note,reviewer) values(progress,'returned',coalesce(note,''),auth.uid());
 end if;
end $$;
create function public.garden_review(p_progress uuid,p_accept boolean,p_note text,p_bonus integer) returns void language sql security invoker set search_path='' as $$ select garden_private.review(p_progress,p_accept,p_note,p_bonus); $$;
create function garden_private.bonus(progress uuid,amount integer,note text) returns void language plpgsql security definer set search_path='' as $$
declare p public.garden_progress%rowtype;
begin
 perform garden_private.require_manager();
 if amount is null or amount not between 1 and 100000 then raise exception 'Thưởng thêm phải từ 1 đến 100000.'; end if;
 select * into p from public.garden_progress where id=progress;
 if not found then raise exception 'Không tìm thấy bài.'; end if;
 perform 1 from public.garden_profiles where user_id=p.user_id for update;
 select * into p from public.garden_progress where id=progress for update;
 if p.status<>'approved' or p.bonus_given then raise exception 'Bài chưa hoàn thành hoặc đã nhận thưởng thêm.'; end if;
 update public.garden_progress set bonus_given=true where id=progress;
 update public.garden_profiles set coins=coins+amount where user_id=p.user_id;
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(p.user_id,amount,'bonus',progress::text,coalesce(note,''));
 insert into public.garden_reviews(progress_id,action,note,amount,reviewer) values(progress,'bonus',coalesce(note,''),amount,auth.uid());
end $$;
create function public.garden_bonus(p_progress uuid,p_amount integer,p_note text) returns void language sql security invoker set search_path='' as $$ select garden_private.bonus(p_progress,p_amount,p_note); $$;
create function garden_private.save_catalog(item text,price integer,seconds integer,xp integer,level integer,reduction integer,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform garden_private.require_manager();
 if price is null or price not between 0 and 100000 or seconds is null or seconds not between 60 and 2592000 or xp is null or xp not between 0 and 100000 or level is null or level not between 1 and 100 or reduction is null or reduction not between 60 and 2592000 then raise exception 'Cấu hình vật phẩm không hợp lệ.'; end if;
 update public.garden_catalog c set price=save_catalog.price,grow_seconds=seconds,xp=save_catalog.xp,min_level=level,reduction_seconds=reduction,active=save_catalog.active where id=item;
 if not found then raise exception 'Không tìm thấy vật phẩm.'; end if;
end $$;
create function public.garden_save_catalog(p_item text,p_price integer,p_seconds integer,p_xp integer,p_level integer,p_reduction integer,p_active boolean) returns void language sql security invoker set search_path='' as $$ select garden_private.save_catalog(p_item,p_price,p_seconds,p_xp,p_level,p_reduction,p_active); $$;
revoke execute on all functions in schema garden_private from public,anon;
grant execute on all functions in schema garden_private to authenticated;
revoke execute on function public.garden_manager(),public.garden_initialize(),public.garden_buy(text,integer,uuid),public.garden_plant(integer,text),public.garden_fertilize(uuid),public.garden_harvest(uuid),public.garden_save_task(uuid,text,text,timestamptz,integer,text,text[]),public.garden_submit_task(uuid,text[]),public.garden_review(uuid,boolean,text,integer),public.garden_bonus(uuid,integer,text),public.garden_save_catalog(text,integer,integer,integer,integer,integer,boolean) from public,anon;
grant execute on function public.garden_manager(),public.garden_initialize(),public.garden_buy(text,integer,uuid),public.garden_plant(integer,text),public.garden_fertilize(uuid),public.garden_harvest(uuid),public.garden_save_task(uuid,text,text,timestamptz,integer,text,text[]),public.garden_submit_task(uuid,text[]),public.garden_review(uuid,boolean,text,integer),public.garden_bonus(uuid,integer,text),public.garden_save_catalog(text,integer,integer,integer,integer,integer,boolean) to authenticated;
