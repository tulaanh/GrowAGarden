alter table public.garden_profiles add column vnd integer not null default 0 check(vnd between 0 and 1000000000);
alter table public.garden_catalog add column sell_price integer not null default 0 check(sell_price between 0 and 1000000);
update public.garden_catalog c set sell_price=v.price from (values
 ('carrot',1000),('rice',1000),('onion',1500),('lettuce',2000),('potato',1500),('cabbage',3000),('corn',3000),
 ('tomato',2000),('eggplant',3000),('pumpkin',8000),('strawberry',3000),('cucumber',2500),('chili',1500),('bell_pepper',4000),
 ('sweet_potato',4000),('pineapple',15000),('watermelon',20000),('peanut',3000),('mango',8000),('apple',8000),('banana',5000)
) v(id,price) where c.id=v.id and c.kind='seed' and not c.retired;
create table garden_private.produce_sales(
 user_id uuid not null references auth.users(id) on delete cascade,
 request uuid not null, item_id text not null references public.garden_catalog(id), quantity integer not null,
 unit_price integer not null, amount integer not null, created_at timestamptz not null default now(), primary key(user_id,request)
);
alter table garden_private.produce_sales enable row level security;
revoke all on garden_private.produce_sales from public,anon,authenticated;
create function garden_private.sell_produce(item text,qty integer,expected_price integer,request uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); balance integer; price integer; total integer; previous garden_private.produce_sales%rowtype;
begin
 select vnd into balance from public.garden_profiles where user_id=u for update;
 if request is null or qty is null or qty not between 1 and 99 then raise exception 'Số lượng bán phải từ 1 đến 99.'; end if;
 select * into previous from garden_private.produce_sales where user_id=u and produce_sales.request=sell_produce.request;
 if found then
  if previous.item_id<>item or previous.quantity<>qty or previous.unit_price is distinct from expected_price then raise exception 'Mã giao dịch đã được dùng cho lượt bán khác.'; end if;
  return previous.amount;
 end if;
 select sell_price into price from public.garden_catalog where id=item and kind='seed' and not retired for share;
 if not found or price<=0 then raise exception 'Nông sản này hiện chưa thể bán.'; end if;
 if expected_price is distinct from price then raise exception 'Giá bán đã thay đổi. Hãy tải lại cửa hàng.'; end if;
 total:=price*qty;
 if balance::bigint+total>1000000000 then raise exception 'Số dư VNĐ vượt giới hạn.'; end if;
 update public.garden_collection set quantity=quantity-qty where user_id=u and seed_id=item and quantity>=qty;
 if not found then raise exception 'Không đủ nông sản để bán.'; end if;
 update public.garden_profiles set vnd=vnd+total where user_id=u;
 insert into garden_private.produce_sales(user_id,request,item_id,quantity,unit_price,amount) values(u,request,item,qty,price,total);
 return total;
end $$;
create function public.garden_sell_produce(p_item text,p_quantity integer,p_price integer,p_request uuid) returns integer
language sql security invoker set search_path='' as $$ select garden_private.sell_produce(p_item,p_quantity,p_price,p_request); $$;
revoke all on function garden_private.sell_produce(text,integer,integer,uuid),public.garden_sell_produce(text,integer,integer,uuid) from public,anon;
grant execute on function garden_private.sell_produce(text,integer,integer,uuid),public.garden_sell_produce(text,integer,integer,uuid) to authenticated;
