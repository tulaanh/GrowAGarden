alter table public.garden_catalog drop constraint garden_catalog_kind_check;
alter table public.garden_catalog add constraint garden_catalog_kind_check check(kind in ('seed','gacha','fertilizer'));

insert into public.garden_catalog(id,name,kind,price,min_level) values
 ('gacha_common','Hạt Thường','gacha',10,1),
 ('gacha_rare','Hạt Hiếm','gacha',30,2),
 ('gacha_special','Hạt Đặc biệt','gacha',60,3);

create table public.garden_seed_drops(
 seed_id text not null references public.garden_catalog(id),
 plant_id text not null references public.garden_catalog(id),
 weight integer not null check(weight between 1 and 10000),
 primary key(seed_id,plant_id)
);
create index garden_seed_drops_plant_idx on public.garden_seed_drops(plant_id);
insert into public.garden_seed_drops(seed_id,plant_id,weight) values
 ('gacha_common','carrot',80),('gacha_common','sunflower',18),('gacha_common','lotus',2),
 ('gacha_rare','carrot',40),('gacha_rare','sunflower',50),('gacha_rare','lotus',10),
 ('gacha_special','carrot',15),('gacha_special','sunflower',35),('gacha_special','lotus',50);
alter table public.garden_seed_drops enable row level security;
revoke all on public.garden_seed_drops from public,anon,authenticated;
grant select on public.garden_seed_drops to authenticated;
create policy "seed odds read" on public.garden_seed_drops for select to authenticated using(true);

alter table public.garden_plots add column source_seed_id text references public.garden_catalog(id);
alter table public.garden_plots add column growth_seconds integer;
update public.garden_plots set source_seed_id=seed_id,
 growth_seconds=greatest(1,ceil(extract(epoch from ready_at-planted_at))::integer);
alter table public.garden_plots alter column growth_seconds set not null;
alter table public.garden_plots add constraint garden_plots_growth_seconds_check check(growth_seconds>0);
create index garden_plots_source_seed_idx on public.garden_plots(source_seed_id);

create or replace function garden_private.buy(item text,qty integer,request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); p public.garden_profiles%rowtype;c public.garden_catalog%rowtype;lv integer;
begin
 select * into p from public.garden_profiles where user_id=u for update;
 if request is null or qty is null or qty not between 1 and 99 then raise exception 'Số lượng không hợp lệ.'; end if;
 if exists(select 1 from public.garden_ledger where user_id=u and kind='purchase' and reference=request::text) then return; end if;
 select * into c from public.garden_catalog where id=item and active and kind in ('gacha','fertilizer');
 if not found then raise exception 'Vật phẩm không còn bán. Hãy chọn hạt gacha trong cửa hàng.'; end if;
 if c.kind='gacha' and not exists(
  select 1 from public.garden_seed_drops d join public.garden_catalog plant on plant.id=d.plant_id
  where d.seed_id=item and plant.kind='seed' and plant.active and plant.grow_seconds>0
 ) then raise exception 'Hạt này hiện chưa có cây để gieo.'; end if;
 lv:=floor((1+sqrt(1+8*p.xp/100.0))/2);
 if lv<c.min_level then raise exception 'Bạn chưa đủ cấp độ.'; end if;
 if p.coins::bigint<c.price::bigint*qty then raise exception 'Chưa đủ Đồng tri thức.'; end if;
 update public.garden_profiles set coins=coins-c.price*qty where user_id=u;
 insert into public.garden_inventory values(u,item,qty) on conflict(user_id,item_id) do update set quantity=public.garden_inventory.quantity+excluded.quantity;
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(u,-c.price*qty,'purchase',request::text,'Mua '||qty||' '||c.name);
end $$;

create or replace function garden_private.plant(slot_no integer,seed text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); source public.garden_catalog%rowtype;c public.garden_catalog%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 if slot_no is null or slot_no not between 0 and 8 then raise exception 'Ô đất không hợp lệ.'; end if;
 select * into source from public.garden_catalog where id=seed and kind in ('seed','gacha');
 if not found then raise exception 'Hạt giống không hợp lệ.'; end if;
 if exists(select 1 from public.garden_plots where user_id=u and slot=slot_no and not harvested) then raise exception 'Ô này đã có cây.'; end if;
 if source.kind='gacha' then
  with eligible as materialized (
   select d.plant_id,d.weight from public.garden_seed_drops d
   join public.garden_catalog plant on plant.id=d.plant_id
   where d.seed_id=seed and plant.kind='seed' and plant.active and plant.grow_seconds>0
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

revoke execute on function garden_private.buy(text,integer,uuid),garden_private.plant(integer,text) from public,anon;
grant execute on function garden_private.buy(text,integer,uuid),garden_private.plant(integer,text) to authenticated;
