create or replace function garden_private.buy(item text,qty integer,request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=garden_private.ensure_profile(); p public.garden_profiles%rowtype;c public.garden_catalog%rowtype;lv integer;
begin
 select * into p from public.garden_profiles where user_id=u for update;
 if request is null or qty is null or qty not between 1 and 99 then raise exception 'Số lượng không hợp lệ.'; end if;
 if exists(select 1 from public.garden_ledger where user_id=u and kind='purchase' and reference=request::text) then return; end if;
 select * into c from public.garden_catalog where id=item and active and not retired and kind in ('seed','gacha','fertilizer');
 if not found then raise exception 'Vật phẩm không còn bán.'; end if;
 if c.kind='seed' and c.id not in ('carrot','rice') and not exists (
  select 1 from public.garden_plots where user_id=u and seed_id=c.id and source_seed_id in ('gacha_common','gacha_rare','gacha_special')
 ) then raise exception 'Hãy khám phá loại cây này bằng hạt gacha trước.'; end if;
 if c.kind='seed' and c.grow_seconds<=0 then raise exception 'Hạt này hiện chưa thể gieo.'; end if;
 if c.kind='gacha' and not exists(
  select 1 from public.garden_seed_drops d join public.garden_catalog plant on plant.id=d.plant_id
  where d.seed_id=item and plant.kind='seed' and plant.active and not plant.retired and plant.grow_seconds>0
 ) then raise exception 'Hạt này hiện chưa có cây để gieo.'; end if;
 lv:=floor((1+sqrt(1+8*p.xp/100.0))/2);
 if c.kind<>'seed' and lv<c.min_level then raise exception 'Bạn chưa đủ cấp độ.'; end if;
 if p.coins::bigint<c.price::bigint*qty then raise exception 'Chưa đủ Đồng tri thức.'; end if;
 update public.garden_profiles set coins=coins-c.price*qty where user_id=u;
 insert into public.garden_inventory values(u,item,qty) on conflict(user_id,item_id) do update set quantity=public.garden_inventory.quantity+excluded.quantity;
 insert into public.garden_ledger(user_id,amount,kind,reference,note) values(u,-c.price*qty,'purchase',request::text,'Mua '||qty||' '||c.name);
end $$;

