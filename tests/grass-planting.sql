begin;
do $$
declare player uuid:=gen_random_uuid(); other_player uuid:=gen_random_uuid(); legacy uuid;
begin
 insert into auth.users(id,aud,role,email) values
 (player,'authenticated','authenticated',player||'@example.invalid'),
 (other_player,'authenticated','authenticated',other_player||'@example.invalid');
 perform set_config('garden_test.player',player::text,true);
 perform set_config('garden_test.other',other_player::text,true);
 perform set_config('request.jwt.claim.sub',player::text,true);
 perform public.garden_initialize();
 perform set_config('request.jwt.claim.sub',other_player::text,true);
 perform public.garden_initialize();
 update public.garden_profiles set coins=case when user_id=player then 10000 else 99 end where user_id in(player,other_player);
 insert into public.garden_inventory(user_id,item_id,quantity) values(player,'carrot',200),(other_player,'carrot',100)
 on conflict(user_id,item_id) do update set quantity=excluded.quantity;
 insert into public.garden_plots(user_id,slot,seed_id,source_seed_id,planted_at,ready_at,growth_seconds,xp_reward)
 values(other_player,4,'carrot','carrot',now()-interval '2 hours',now()-interval '1 hour',1800,20) returning id into legacy;
 perform set_config('garden_test.legacy',legacy::text,true);
 if to_regprocedure('public.garden_unlock_grass(integer,integer,uuid)') is not null then raise exception 'TEST: obsolete patch unlock API remains'; end if;
 if has_function_privilege('anon','public.garden_unlock_slot(integer,integer,uuid)','execute') then raise exception 'TEST: anonymous unlocking allowed'; end if;
end $$;
set local role authenticated;
do $$
declare player uuid:=current_setting('garden_test.player')::uuid;
 other_player uuid:=current_setting('garden_test.other')::uuid; slot_no integer; target_slot integer; price integer:=100; total integer:=0; request uuid:=gen_random_uuid();
begin
 perform set_config('request.jwt.claim.sub',player::text,true);
 if exists(select 1 from public.garden_unlocked_slots) then raise exception 'TEST: new player does not start with only four free positions'; end if;
 foreach target_slot in array array[-1,3,16,null] loop
  begin perform public.garden_unlock_slot(target_slot,100,gen_random_uuid());raise exception 'TEST: invalid planting position accepted';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 end loop;
 begin
  perform public.garden_plant(4,'carrot');raise exception 'TEST: planting on locked grass allowed';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform public.garden_unlock_slot(15,100,request);
 perform public.garden_unlock_slot(15,100,request);
 perform public.garden_unlock_slot(15,100,gen_random_uuid());
 if (select coins from public.garden_profiles where user_id=player)<>9900 then raise exception 'TEST: retry charged twice'; end if;
 begin
  perform public.garden_unlock_slot(14,200,request);raise exception 'TEST: request reused for another tile';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_unlock_slot(14,100,gen_random_uuid());raise exception 'TEST: stale or forged price accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 total:=100;
 for target_slot in reverse 14..4 loop
  price:=price+100;total:=total+price;
  perform public.garden_unlock_slot(target_slot,price,gen_random_uuid());
 end loop;
 if total<>7800 or (select coins from public.garden_profiles where user_id=player)<>2200
 or (select count(*) from public.garden_unlocked_slots)<>12 or (select count(*) from public.garden_ledger where kind='slot_unlock')<>12 then raise exception 'TEST: unlock progression, balance or ledger incorrect'; end if;
 for slot_no in 0..15 loop perform public.garden_plant(slot_no,'carrot'); end loop;
 if (select count(*) from public.garden_plots where not harvested)<>16 then raise exception 'TEST: full garden capacity incorrect'; end if;
 foreach slot_no in array array[-1,16,144,50000,null] loop
  begin perform public.garden_plant(slot_no,'carrot');raise exception 'TEST: invalid slot accepted';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 end loop;
 begin
  perform public.garden_plant(0,'carrot');raise exception 'TEST: duplicate planting accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 if (select quantity from public.garden_inventory where user_id=player and item_id='carrot')<>184 then raise exception 'TEST: failed planting consumed seeds'; end if;
 perform set_config('request.jwt.claim.sub',other_player::text,true);
 if exists(select 1 from public.garden_unlocked_slots where user_id=player) or exists(select 1 from public.garden_plots where user_id=player) then raise exception 'TEST: ownership RLS bypassed'; end if;
 begin
  perform public.garden_unlock_slot(4,100,gen_random_uuid());raise exception 'TEST: insufficient balance accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 if (select coins from public.garden_profiles where user_id=other_player)<>99 or exists(select 1 from public.garden_unlocked_slots) then raise exception 'TEST: failed unlock changed state'; end if;
 begin
  insert into public.garden_unlocked_slots(user_id,slot,cost,request_id) values(other_player,4,0,gen_random_uuid());raise exception 'TEST: direct land write allowed';
 exception when insufficient_privilege then null; end;
 perform public.garden_harvest(current_setting('garden_test.legacy')::uuid);
 if (select xp from public.garden_profiles where user_id=other_player)<>20 then raise exception 'TEST: existing crop on locked position cannot be harvested'; end if;
 for slot_no in 0..3 loop perform public.garden_plant(slot_no,'carrot'); end loop;
 begin
  perform public.garden_plant(4,'carrot');raise exception 'TEST: another player unlock grants access';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end $$;
rollback;
