alter table public.garden_catalog add column yield_min integer not null default 1, add column yield_max integer not null default 3;
alter table public.garden_catalog add constraint garden_yield_range check (yield_min between 1 and 100 and yield_max between yield_min and 100);
update public.garden_catalog set yield_min=2,yield_max=5 where id='carrot';
update public.garden_catalog set yield_min=1,yield_max=2 where id='watermelon';
create function garden_private.harvest_quantity(plot uuid) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); p public.garden_plots%rowtype; lo integer; hi integer; amount integer;
begin
 perform 1 from public.garden_profiles where user_id=u for update;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at>now() then raise exception 'Cây chưa sẵn sàng thu hoạch.'; end if;
 select yield_min,yield_max into strict lo,hi from public.garden_catalog where id=p.seed_id;
 amount:=lo+floor(random()*(hi-lo+1))::integer;
 update public.garden_plots set harvested=true where id=plot;
 update public.garden_profiles set xp=xp+p.xp_reward where user_id=u;
 insert into public.garden_collection values(u,p.seed_id,amount) on conflict(user_id,seed_id) do update set quantity=public.garden_collection.quantity+excluded.quantity;
 return amount;
end $$;
create or replace function garden_private.harvest(plot uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform garden_private.harvest_quantity(plot); end $$;
create function public.garden_harvest_quantity(p_plot uuid) returns integer language sql security invoker set search_path='' as $$ select garden_private.harvest_quantity(p_plot); $$;
create function garden_private.save_yield(item text, lo integer, hi integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.garden_manager() then raise exception 'Không có quyền quản lý.'; end if;
 if lo is null or hi is null or lo<1 or hi>100 or lo>hi then raise exception 'Sản lượng không hợp lệ.'; end if;
 update public.garden_catalog set yield_min=lo,yield_max=hi where id=item and kind='seed' and not retired;
 if not found then raise exception 'Không tìm thấy cây.'; end if;
end $$;
create function public.garden_save_yield(p_item text,p_min integer,p_max integer) returns void language sql security invoker set search_path='' as $$ select garden_private.save_yield(p_item,p_min,p_max); $$;
revoke all on function garden_private.harvest_quantity(uuid),garden_private.save_yield(text,integer,integer),public.garden_harvest_quantity(uuid),public.garden_save_yield(text,integer,integer) from public,anon;
grant execute on function garden_private.harvest_quantity(uuid),garden_private.save_yield(text,integer,integer),public.garden_harvest_quantity(uuid),public.garden_save_yield(text,integer,integer) to authenticated;
