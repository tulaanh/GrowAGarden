lock table public.garden_profiles,public.garden_plots,public.garden_inventory,public.garden_collection,public.garden_catalog,public.garden_seed_drops in share row exclusive mode;
create temporary table garden_tropical_before on commit drop as select
 (select jsonb_agg(to_jsonb(p) order by user_id) from public.garden_profiles p) profiles,
 (select jsonb_agg(to_jsonb(p)-'seed_id'-'source_seed_id' order by id) from public.garden_plots p) plots,
 (select jsonb_agg(to_jsonb(s) order by user_id) from(select user_id,sum(quantity) quantity from public.garden_inventory group by user_id)s) inventory,
 (select jsonb_agg(to_jsonb(s) order by user_id) from(select user_id,sum(quantity) quantity from public.garden_collection group by user_id)s) collection;

alter table public.garden_catalog add column retired boolean not null default false;
insert into public.garden_catalog(id,name,kind,price,grow_seconds,xp,min_level) values
 ('carrot','Cà rốt','seed',10,1800,20,1),
 ('rice','Lúa','seed',10,2700,30,1),('onion','Hành tây','seed',10,2700,30,1),
 ('lettuce','Xà lách','seed',10,1800,20,1),('potato','Khoai tây','seed',10,3600,40,1),
 ('cabbage','Bắp cải','seed',10,3600,40,1),('corn','Ngô','seed',10,7200,60,1),
 ('tomato','Cà chua','seed',30,5400,50,2),('eggplant','Cà tím','seed',30,7200,60,2),
 ('pumpkin','Bí ngô','seed',30,10800,90,2),('strawberry','Dâu tây','seed',30,7200,60,2),
 ('cucumber','Dưa chuột','seed',30,5400,50,2),('chili','Ớt','seed',30,7200,60,2),
 ('bell_pepper','Ớt chuông','seed',30,9000,75,2),('sweet_potato','Khoai lang','seed',30,7200,60,2),
 ('pineapple','Dứa','seed',60,14400,120,3),('watermelon','Dưa hấu','seed',60,14400,120,3),
 ('peanut','Đậu phộng','seed',60,10800,90,3),('mango','Xoài','seed',60,21600,150,3),
 ('apple','Táo','seed',60,21600,150,3),('banana','Chuối','seed',60,18000,140,3)
on conflict(id) do nothing;

update public.garden_catalog replacement set price=old.price,grow_seconds=old.grow_seconds,
 xp=old.xp,min_level=old.min_level,active=old.active
from public.garden_catalog old
where (old.id='sunflower' and replacement.id='corn') or (old.id='lotus' and replacement.id='mango');

alter table public.garden_plots drop constraint garden_plots_assignment_id_check;
update public.garden_plots set
 seed_id=case seed_id when 'sunflower' then 'corn' when 'lotus' then 'mango' else seed_id end,
 source_seed_id=case source_seed_id when 'sunflower' then 'corn' when 'lotus' then 'mango' else source_seed_id end
where seed_id in ('sunflower','lotus') or source_seed_id in ('sunflower','lotus');
alter table public.garden_plots add constraint garden_plots_species_check check(seed_id in (
 'carrot','rice','onion','lettuce','potato','cabbage','corn','tomato','eggplant','pumpkin',
 'strawberry','cucumber','chili','bell_pepper','sweet_potato','pineapple','watermelon','peanut','mango','apple','banana'
));

insert into public.garden_inventory(user_id,item_id,quantity)
 select user_id,case item_id when 'sunflower' then 'corn' else 'mango' end,quantity
 from public.garden_inventory where item_id in ('sunflower','lotus')
on conflict(user_id,item_id) do update set quantity=public.garden_inventory.quantity+excluded.quantity;
delete from public.garden_inventory where item_id in ('sunflower','lotus');
insert into public.garden_collection(user_id,seed_id,quantity)
 select user_id,case seed_id when 'sunflower' then 'corn' else 'mango' end,quantity
 from public.garden_collection where seed_id in ('sunflower','lotus')
on conflict(user_id,seed_id) do update set quantity=public.garden_collection.quantity+excluded.quantity;
delete from public.garden_collection where seed_id in ('sunflower','lotus');
update public.garden_catalog set retired=true,active=false where id in ('sunflower','lotus');
alter policy "catalog read" on public.garden_catalog using(not retired);

delete from public.garden_seed_drops;
insert into public.garden_seed_drops(seed_id,plant_id,weight)
select seed.id,plant.id,case seed.id
 when 'gacha_common' then case plant.tier when 1 then 1920 when 2 then 378 else 56 end
 when 'gacha_rare' then case plant.tier when 1 then 960 when 2 then 1050 else 280 end
 else case plant.tier when 1 then 360 when 2 then 735 else 1400 end end
from (values('gacha_common'),('gacha_rare'),('gacha_special')) seed(id)
cross join (values
 ('carrot',1),('rice',1),('onion',1),('lettuce',1),('potato',1),('cabbage',1),('corn',1),
 ('tomato',2),('eggplant',2),('pumpkin',2),('strawberry',2),('cucumber',2),('chili',2),('bell_pepper',2),('sweet_potato',2),
 ('pineapple',3),('watermelon',3),('peanut',3),('mango',3),('apple',3),('banana',3)
) plant(id,tier);

create or replace function garden_private.plant(slot_no integer,seed text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); source public.garden_catalog%rowtype;c public.garden_catalog%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 if slot_no is null or slot_no not between 0 and 8 then raise exception 'Ô đất không hợp lệ.'; end if;
 select * into source from public.garden_catalog where id=seed and kind in ('seed','gacha') and not retired;
 if not found then raise exception 'Hạt giống không hợp lệ hoặc đã được thay thế.'; end if;
 if exists(select 1 from public.garden_plots where user_id=u and slot=slot_no and not harvested) then raise exception 'Ô này đã có cây.'; end if;
 if source.kind='gacha' then
  with eligible as materialized (
   select d.plant_id,d.weight from public.garden_seed_drops d
   join public.garden_catalog plant on plant.id=d.plant_id
   where d.seed_id=seed and plant.kind='seed' and plant.active and not plant.retired and plant.grow_seconds>0
  ), draw as materialized (select random()*sum(weight) target from eligible),
  weighted as (select plant_id,sum(weight) over(order by plant_id) cumulative from eligible)
  select plant.* into c from weighted cross join draw
  join public.garden_catalog plant on plant.id=weighted.plant_id
  where weighted.cumulative>draw.target order by weighted.cumulative limit 1;
  if not found then raise exception 'Hạt này hiện chưa có cây để gieo.'; end if;
 else
  c:=source;
 end if;
 if c.grow_seconds<=0 then raise exception 'Thời gian lớn của cây chưa hợp lệ.'; end if;
 update public.garden_inventory set quantity=quantity-1 where user_id=u and item_id=seed and quantity>0;
 if not found then raise exception 'Bạn chưa có hạt giống này.'; end if;
 insert into public.garden_plots(user_id,slot,seed_id,source_seed_id,planted_at,ready_at,growth_seconds,xp_reward)
 values(u,slot_no,c.id,seed,now(),now()+make_interval(secs=>c.grow_seconds),c.grow_seconds,c.xp);
end $$;

create or replace function garden_private.save_catalog(item text,price integer,seconds integer,xp integer,level integer,reduction integer,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform garden_private.require_manager();
 if price is null or price not between 0 and 100000 or seconds is null or seconds not between 60 and 2592000 or xp is null or xp not between 0 and 100000 or level is null or level not between 1 and 100 or reduction is null or reduction not between 60 and 2592000 then raise exception 'Cấu hình vật phẩm không hợp lệ.'; end if;
 update public.garden_catalog c set price=save_catalog.price,grow_seconds=seconds,xp=save_catalog.xp,min_level=level,reduction_seconds=reduction,active=save_catalog.active where id=item and not retired;
 if not found then raise exception 'Không tìm thấy vật phẩm hoặc cây đã được thay thế.'; end if;
end $$;

create or replace function garden_private.cheat(action text,amount integer,item text,request uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid; p public.garden_profiles%rowtype; stock integer; changed integer:=0;
begin
 perform garden_private.require_manager();
 u:=garden_private.ensure_profile();
 if request is null or action is null or action not in ('coins','xp','inventory','ready_all') then raise exception 'Thao tác cheat không hợp lệ.'; end if;
 select * into p from public.garden_profiles where user_id=u for update;
 if exists(select 1 from garden_private.cheat_events where actor_id=u and request_id=request) then return; end if;
 if action in ('coins','xp') then
  if amount is null or amount not between 1 and 1000000 then raise exception 'Số lượng phải từ 1 đến 1000000.'; end if;
  if action='coins' then
   if p.coins::bigint+amount>1000000000 then raise exception 'Số dư vượt giới hạn.'; end if;
   update public.garden_profiles set coins=coins+amount where user_id=u;
   insert into public.garden_ledger(user_id,amount,kind,reference,note) values(u,amount,'admin_credit',request::text,'Cheat menu: cấp Đồng tri thức');
  else
   if p.xp::bigint+amount>1000000000 then raise exception 'XP vượt giới hạn.'; end if;
   update public.garden_profiles set xp=xp+amount where user_id=u;
  end if;
  changed:=amount;
 elsif action='inventory' then
  if amount is null or amount not between 1 and 9999 then raise exception 'Số vật phẩm phải từ 1 đến 9999.'; end if;
  if item is null or not exists(select 1 from public.garden_catalog where id=item and not retired) then raise exception 'Vật phẩm không hợp lệ hoặc đã được thay thế.'; end if;
  select quantity into stock from public.garden_inventory where user_id=u and item_id=item;
  if coalesce(stock,0)::bigint+amount>1000000000 then raise exception 'Kho vật phẩm vượt giới hạn.'; end if;
  insert into public.garden_inventory(user_id,item_id,quantity) values(u,item,amount)
  on conflict(user_id,item_id) do update set quantity=public.garden_inventory.quantity+excluded.quantity;
  changed:=amount;
 else
  update public.garden_plots set ready_at=now() where user_id=u and not harvested and ready_at>now();
  get diagnostics changed=row_count;
 end if;
 insert into garden_private.cheat_events(actor_id,request_id,action,amount,item_id)
 values(u,request,action,changed,case when action='inventory' then item else null end);
end $$;

revoke execute on function garden_private.plant(integer,text),garden_private.save_catalog(text,integer,integer,integer,integer,integer,boolean),garden_private.cheat(text,integer,text,uuid) from public,anon;
grant execute on function garden_private.plant(integer,text),garden_private.save_catalog(text,integer,integer,integer,integer,integer,boolean),garden_private.cheat(text,integer,text,uuid) to authenticated;

do $$
declare before_state record;
begin
 select * into before_state from garden_tropical_before;
 if before_state.profiles is distinct from (select jsonb_agg(to_jsonb(p) order by user_id) from public.garden_profiles p)
 or before_state.plots is distinct from (select jsonb_agg(to_jsonb(p)-'seed_id'-'source_seed_id' order by id) from public.garden_plots p)
 or before_state.inventory is distinct from (select jsonb_agg(to_jsonb(s) order by user_id) from(select user_id,sum(quantity) quantity from public.garden_inventory group by user_id)s)
 or before_state.collection is distinct from (select jsonb_agg(to_jsonb(s) order by user_id) from(select user_id,sum(quantity) quantity from public.garden_collection group by user_id)s) then
  raise exception 'Crop migration changed player balances, growth snapshots or item totals.';
 end if;
end $$;
