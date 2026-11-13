create table garden_private.cheat_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 action text not null check(action in ('coins','xp','inventory','ready_all')),
 amount integer not null,
 item_id text references public.garden_catalog(id),
 created_at timestamptz not null default now(),
 unique(actor_id,request_id)
);
alter table garden_private.cheat_events enable row level security;
revoke all on garden_private.cheat_events from public,anon,authenticated;

create function garden_private.cheat(action text,amount integer,item text,request uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid; p public.garden_profiles%rowtype; stock integer; changed integer:=0;
begin
 perform garden_private.require_manager();
 u:=garden_private.ensure_profile();
 if request is null or action is null or action not in ('coins','xp','inventory','ready_all') then
  raise exception 'Thao tác cheat không hợp lệ.';
 end if;
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
  if item is null or not exists(select 1 from public.garden_catalog where id=item) then raise exception 'Vật phẩm không hợp lệ.'; end if;
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
create function public.garden_cheat(p_action text,p_amount integer,p_item text,p_request uuid)
returns void language sql security invoker set search_path='' as $$
 select garden_private.cheat(p_action,p_amount,p_item,p_request);
$$;
revoke execute on function garden_private.cheat(text,integer,text,uuid),public.garden_cheat(text,integer,text,uuid) from public,anon;
grant execute on function garden_private.cheat(text,integer,text,uuid),public.garden_cheat(text,integer,text,uuid) to authenticated;
