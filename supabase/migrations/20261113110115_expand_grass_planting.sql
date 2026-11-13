set local lock_timeout = '5s';
lock table public.garden_plots in share row exclusive mode;

alter table public.garden_plots drop constraint garden_plots_slot_check;
alter table public.garden_plots add constraint garden_plots_slot_check check (slot >= 0);

create or replace function garden_private.plant(slot_no integer,seed text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); source public.garden_catalog%rowtype;c public.garden_catalog%rowtype;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 if slot_no is null or slot_no < 0 then raise exception 'Ô đất không hợp lệ.'; end if;
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
