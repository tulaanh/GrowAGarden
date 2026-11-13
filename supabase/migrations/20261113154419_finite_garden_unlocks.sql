set local lock_timeout = '5s';
lock table public.garden_profiles,public.garden_plots in share row exclusive mode;

do $$ begin
 if exists(select 1 from public.garden_plots where not harvested and slot not between 0 and 143) then
  raise exception 'Cần chuyển cây ngoài 16 ô cỏ trước khi áp dụng giới hạn mới.';
 end if;
end $$;

create table public.garden_land (
 user_id uuid not null references auth.users(id) on delete cascade,
 tile integer not null check(tile between 4 and 15),
 cost integer not null check(cost>=0),
 request_id uuid not null,
 opened_at timestamptz not null default now(),
 primary key(user_id,tile),unique(user_id,request_id)
);
alter table public.garden_land enable row level security;
create policy "own land" on public.garden_land for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.garden_land from public,anon,authenticated;
grant select on public.garden_land to authenticated;

insert into public.garden_land(user_id,tile,cost,request_id)
select user_id,tile,0,gen_random_uuid() from (
 select distinct user_id,slot/9 as tile from public.garden_plots where not harvested and slot>=36
) existing_land;

alter table public.garden_plots drop constraint garden_plots_slot_check;
alter table public.garden_plots add constraint garden_plots_slot_check check(slot>=0 and (harvested or slot<=143));

create function garden_private.unlock_grass(tile_no integer,expected_cost integer,request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); balance integer; price integer;
begin
 select coins into balance from public.garden_profiles where user_id=u for update;
 if request is null or tile_no is null or tile_no not between 4 and 15 then raise exception 'Ô cỏ không hợp lệ.'; end if;
 if exists(select 1 from public.garden_land where user_id=u and request_id=request) then
  if exists(select 1 from public.garden_land where user_id=u and request_id=request and tile=tile_no) then return; end if;
  raise exception 'Yêu cầu này đã được dùng để mở ô khác.';
 end if;
 if exists(select 1 from public.garden_land where user_id=u and tile=tile_no) then return; end if;
 select (count(*)+1)*100 into price from public.garden_land where user_id=u;
 if expected_cost is null or expected_cost<>price then raise exception 'Giá mở ô đã thay đổi. Vui lòng tải lại khu vườn.'; end if;
 if balance<price then raise exception 'Chưa đủ Đồng tri thức để mở ô cỏ.'; end if;
 update public.garden_profiles set coins=coins-price where user_id=u;
 insert into public.garden_land(user_id,tile,cost,request_id) values(u,tile_no,price,request);
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(u,-price,'land_unlock',request::text,'Mở ô cỏ '||(tile_no+1));
end $$;
create function public.garden_unlock_grass(p_tile integer,p_cost integer,p_request uuid) returns void
language sql security invoker set search_path='' as $$ select garden_private.unlock_grass(p_tile,p_cost,p_request); $$;
revoke execute on function garden_private.unlock_grass(integer,integer,uuid),public.garden_unlock_grass(integer,integer,uuid) from public,anon;
grant execute on function garden_private.unlock_grass(integer,integer,uuid),public.garden_unlock_grass(integer,integer,uuid) to authenticated;

create or replace function garden_private.plant(slot_no integer,seed text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); source public.garden_catalog%rowtype;c public.garden_catalog%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 if slot_no is null or slot_no not between 0 and 143 then raise exception 'Ô đất không hợp lệ.'; end if;
 if slot_no>=36 and not exists(select 1 from public.garden_land where user_id=u and tile=slot_no/9) then raise exception 'Bạn cần mở khóa ô cỏ này trước khi gieo hạt.'; end if;
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
