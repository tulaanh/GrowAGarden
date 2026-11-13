begin;
do $$
declare admin_id uuid:=gen_random_uuid();player_id uuid:=gen_random_uuid();request uuid:=gen_random_uuid();plot_id uuid;balance integer;
begin
 insert into auth.users(id,aud,role,email) values(admin_id,'authenticated','authenticated',admin_id||'@example.invalid'),(player_id,'authenticated','authenticated',player_id||'@example.invalid');
 insert into garden_private.managers(user_id) values(admin_id);
 perform set_config('request.jwt.claim.sub',player_id::text,true);
 begin
  perform public.garden_cheat('coins',1000,null,gen_random_uuid());
  raise exception 'TEST: ordinary player could cheat';
 exception when raise_exception then if sqlerrm='TEST: ordinary player could cheat' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.garden_cheat('coins',1000,null,gen_random_uuid());
  raise exception 'TEST: unauthenticated caller could cheat';
 exception when raise_exception then if sqlerrm='TEST: unauthenticated caller could cheat' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.garden_cheat('coins',1000,null,request);
 perform public.garden_cheat('coins',1000,null,request);
 select coins into balance from public.garden_profiles where user_id=admin_id;
 if balance<>1000 then raise exception 'TEST: repeated request added money'; end if;
 if (select count(*) from public.garden_ledger where user_id=admin_id and kind='admin_credit')<>1 then raise exception 'TEST: incorrect ledger'; end if;
 perform public.garden_cheat('xp',300,null,gen_random_uuid());
 if (select xp from public.garden_profiles where user_id=admin_id)<>300 then raise exception 'TEST: incorrect XP'; end if;
 perform public.garden_cheat('inventory',3,'carrot',gen_random_uuid());
 perform public.garden_cheat('inventory',2,'fertilizer',gen_random_uuid());
 if (select quantity from public.garden_inventory where user_id=admin_id and item_id='carrot')<>3 then raise exception 'TEST: incorrect seeds'; end if;
 perform public.garden_plant(0,'carrot');
 select id into plot_id from public.garden_plots where user_id=admin_id and not harvested;
 perform public.garden_cheat('ready_all',0,null,gen_random_uuid());
 if (select ready_at from public.garden_plots where id=plot_id)>now() then raise exception 'TEST: plant not ready'; end if;
 if (select xp from public.garden_profiles where user_id=admin_id)<>300 then raise exception 'TEST: ready action awarded XP'; end if;
 perform public.garden_harvest(plot_id);
 if (select xp from public.garden_profiles where user_id=admin_id)<>320 then raise exception 'TEST: harvest after cheat failed'; end if;
 begin
  perform public.garden_cheat('coins',-1,null,gen_random_uuid());
  raise exception 'TEST: negative amount accepted';
 exception when raise_exception then if sqlerrm='TEST: negative amount accepted' then raise; end if; end;
 begin
  perform public.garden_cheat('inventory',1,'invalid-item',gen_random_uuid());
  raise exception 'TEST: invalid item accepted';
 exception when raise_exception then if sqlerrm='TEST: invalid item accepted' then raise; end if; end;
 if exists(select 1 from public.garden_profiles where user_id=player_id) then raise exception 'TEST: cheat changed another player'; end if;
 if has_function_privilege('anon','public.garden_cheat(text,integer,text,uuid)','EXECUTE') then raise exception 'TEST: anon execute privilege'; end if;
 if has_table_privilege('authenticated','garden_private.cheat_events','SELECT') then raise exception 'TEST: audit log directly exposed'; end if;
end $$;
rollback;
