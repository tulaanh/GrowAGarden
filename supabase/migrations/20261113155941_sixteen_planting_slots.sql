set local lock_timeout = '5s';
lock table public.garden_profiles,public.garden_plots,public.garden_land in share row exclusive mode;
create temporary table garden_slots_before on commit drop as select
 (select md5(coalesce(jsonb_agg(to_jsonb(p)-'slot' order by id)::text,'[]')) from public.garden_plots p) as plants,
 (select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id)::text,'[]')) from public.garden_profiles p) as profiles;
do $$ begin
 if exists(select 1 from public.garden_plots where not harvested group by user_id having count(*)>16) then
  raise exception 'Có tài khoản đang trồng hơn 16 cây; cần xử lý cây hiện có trước khi giảm giới hạn.';
 end if;
end $$;

create temporary table garden_slot_moves on commit drop as
with overflow as (
 select id,user_id,row_number() over(partition by user_id order by slot,id) as n
 from public.garden_plots where not harvested and slot>15
), owners as (select distinct user_id from overflow),
available as (
 select owners.user_id,s.slot,row_number() over(partition by owners.user_id order by s.slot) as n
 from owners cross join generate_series(0,15) s(slot)
 where not exists(select 1 from public.garden_plots p where p.user_id=owners.user_id and p.slot=s.slot and not p.harvested)
)
select overflow.id,available.slot from overflow join available using(user_id,n);
update public.garden_plots p set slot=m.slot from garden_slot_moves m where p.id=m.id;

alter table public.garden_plots drop constraint garden_plots_slot_check;
alter table public.garden_plots add constraint garden_plots_slot_check check(slot>=0 and (harvested or slot<=15));
alter table public.garden_land rename to garden_unlocked_slots;
alter table public.garden_unlocked_slots rename column tile to slot;
alter policy "own land" on public.garden_unlocked_slots rename to "own unlocked slots";

drop function public.garden_unlock_grass(integer,integer,uuid);
drop function garden_private.unlock_grass(integer,integer,uuid);

create function garden_private.unlock_slot(slot_no integer,expected_cost integer,request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); balance integer; price integer;
begin
 select coins into balance from public.garden_profiles where user_id=u for update;
 if request is null or slot_no is null or slot_no not between 4 and 15 then raise exception 'Vị trí trồng không hợp lệ.'; end if;
 if exists(select 1 from public.garden_unlocked_slots where user_id=u and request_id=request) then
  if exists(select 1 from public.garden_unlocked_slots where user_id=u and request_id=request and slot=slot_no) then return; end if;
  raise exception 'Yêu cầu này đã được dùng để mở vị trí khác.';
 end if;
 if exists(select 1 from public.garden_unlocked_slots where user_id=u and slot=slot_no) then return; end if;
 select (count(*)+1)*100 into price from public.garden_unlocked_slots where user_id=u;
 if expected_cost is null or expected_cost<>price then raise exception 'Giá mở vị trí đã thay đổi. Vui lòng tải lại khu vườn.'; end if;
 if balance<price then raise exception 'Chưa đủ Đồng tri thức để mở vị trí trồng.'; end if;
 update public.garden_profiles set coins=coins-price where user_id=u;
 insert into public.garden_unlocked_slots(user_id,slot,cost,request_id) values(u,slot_no,price,request);
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(u,-price,'slot_unlock',request::text,'Mở vị trí trồng '||(slot_no+1));
end $$;
create function public.garden_unlock_slot(p_slot integer,p_cost integer,p_request uuid) returns void
language sql security invoker set search_path='' as $$ select garden_private.unlock_slot(p_slot,p_cost,p_request); $$;
revoke execute on function garden_private.unlock_slot(integer,integer,uuid),public.garden_unlock_slot(integer,integer,uuid) from public,anon;
grant execute on function garden_private.unlock_slot(integer,integer,uuid),public.garden_unlock_slot(integer,integer,uuid) to authenticated;

create or replace function garden_private.plant(slot_no integer,seed text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); source public.garden_catalog%rowtype;c public.garden_catalog%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 if slot_no is null or slot_no not between 0 and 15 then raise exception 'Ô đất không hợp lệ.'; end if;
 if slot_no>=4 and not exists(select 1 from public.garden_unlocked_slots where user_id=u and slot=slot_no) then raise exception 'Bạn cần mở khóa vị trí này trước khi gieo hạt.'; end if;
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

do $$ begin
 if (select plants from garden_slots_before) is distinct from
 (select md5(coalesce(jsonb_agg(to_jsonb(p)-'slot' order by id)::text,'[]')) from public.garden_plots p)
 or (select profiles from garden_slots_before) is distinct from
 (select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id)::text,'[]')) from public.garden_profiles p) then
  raise exception 'Dữ liệu cây hoặc tài khoản bị thay đổi ngoài việc sắp xếp vị trí.';
 end if;
end $$;
