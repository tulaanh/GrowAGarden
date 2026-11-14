begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); result integer; coins_before integer;
begin
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','sale@test.invalid'),(other_user,'authenticated','authenticated','other-sale@test.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.garden_initialize();
 select coins into coins_before from public.garden_profiles where user_id=u;
 insert into public.garden_collection values(u,'carrot',5);
 result:=public.garden_sell_produce('carrot',2,1000,request);
 if result<>2000 or (select quantity from public.garden_collection where user_id=u and seed_id='carrot')<>3 or (select vnd from public.garden_profiles where user_id=u)<>2000 or (select coins from public.garden_profiles where user_id=u)<>coins_before then raise exception 'TEST: incorrect sale'; end if;
 perform public.garden_sell_produce('carrot',2,1000,request);
 if (select vnd from public.garden_profiles where user_id=u)<>2000 or (select quantity from public.garden_collection where user_id=u and seed_id='carrot')<>3 then raise exception 'TEST: duplicate sale'; end if;
 begin
  perform public.garden_sell_produce('carrot',3,1000,request);
  raise exception 'TEST: request payload changed';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_sell_produce('carrot',4,1000,gen_random_uuid());
  raise exception 'TEST: oversold';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_sell_produce('carrot',1,9999,gen_random_uuid());
  raise exception 'TEST: client price trusted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_sell_produce('carrot',-1,1000,gen_random_uuid());
  raise exception 'TEST: negative quantity';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_sell_produce('fertilizer',1,1000,gen_random_uuid());
  raise exception 'TEST: sold fertilizer';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 begin
  perform public.garden_sell_produce('carrot',1,1000,gen_random_uuid());
  raise exception 'TEST: sold another users produce';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.garden_sell_produce('carrot',3,1000,gen_random_uuid());
 if (select quantity from public.garden_collection where user_id=u and seed_id='carrot')<>0 or (select vnd from public.garden_profiles where user_id=u)<>5000 then raise exception 'TEST: sell remainder'; end if;
 if has_function_privilege('anon','public.garden_sell_produce(text,integer,integer,uuid)','execute') or has_table_privilege('authenticated','garden_private.produce_sales','insert') then raise exception 'TEST: unsafe grants'; end if;
end $$;
rollback;
