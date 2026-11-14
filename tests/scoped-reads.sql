begin;
do $$
declare player uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email) values(player,'authenticated','authenticated',player||'@test.invalid'),(other_user,'authenticated','authenticated',other_user||'@test.invalid'),(manager,'authenticated','authenticated',manager||'@test.invalid');
 insert into garden_private.managers values(manager);
 perform set_config('test.player',player::text,true); perform set_config('test.other',other_user::text,true); perform set_config('test.manager',manager::text,true);
 perform set_config('request.jwt.claim.sub',player::text,true); perform public.garden_initialize();
 perform set_config('request.jwt.claim.sub',other_user::text,true); perform public.garden_initialize();
 perform set_config('request.jwt.claim.sub',manager::text,true); perform public.garden_initialize();
 insert into public.garden_plots(user_id,slot,seed_id,source_seed_id,planted_at,ready_at,growth_seconds,xp_reward,harvested)
 select player,0,'tomato','gacha_common',now(),now(),60,20,true from generate_series(1,1200);
 insert into public.garden_plots(user_id,slot,seed_id,source_seed_id,planted_at,ready_at,growth_seconds,xp_reward,harvested)
 values(other_user,0,'mango','gacha_special',now(),now(),60,20,true);
 insert into public.garden_tasks(title,status,created_by,created_at)
 select 'Page '||i,'published',manager,'2026-01-01'::timestamptz from generate_series(1,1100) i;
 insert into public.garden_tasks(title,status,created_by) values('Secret','draft',manager);
 insert into public.garden_progress(user_id,task_id,status,reward_snapshot,submitted_at)
 select player,id,'approved',20,'2026-01-01' from public.garden_tasks where status='published' order by id limit 1050;
 insert into public.garden_ledger(user_id,amount,kind,reference,created_at)
 select player,1,'test',i::text,'2026-01-01' from generate_series(1,1100) i;
end $$;
set local role authenticated;
do $$
declare ids text[]; cursor_at timestamptz; cursor_id uuid; row record; n integer:=0; distinct_ids uuid[]:='{}';
begin
 perform set_config('request.jwt.claim.sub',current_setting('test.player'),true);
 ids:=public.garden_discovered_seeds();
 if not ('tomato'=any(ids)) or 'mango'=any(ids) or not ('carrot'=any(ids)) or not ('rice'=any(ids)) then raise exception 'TEST: discovery or isolation failed'; end if;
 loop
  for row in select id,created_at from public.garden_task_page(false,false,cursor_at,cursor_id,50) loop
   if row.id=any(distinct_ids) then raise exception 'TEST: duplicate pagination result'; end if;
   distinct_ids:=array_append(distinct_ids,row.id); n:=n+1; cursor_at:=row.created_at;cursor_id:=row.id;
  end loop;
  exit when not found;
 end loop;
 if n<>1100 then raise exception 'TEST: expected 1100 tasks, got %',n; end if;
 cursor_at:=null;cursor_id:=null;n:=0;distinct_ids:='{}';
 loop
  for row in select id,created_at from public.garden_task_page(false,true,cursor_at,cursor_id,50) loop
   if row.id=any(distinct_ids) then raise exception 'TEST: duplicate open task'; end if;
   distinct_ids:=array_append(distinct_ids,row.id);n:=n+1;cursor_at:=row.created_at;cursor_id:=row.id;
  end loop;
  exit when not found;
 end loop;
 if n<>50 then raise exception 'TEST: open task filter'; end if;
 cursor_at:=null;cursor_id:=null;n:=0;distinct_ids:='{}';
 loop
  for row in select id,created_at from public.garden_ledger where cursor_at is null or (created_at,id)<(cursor_at,cursor_id) order by created_at desc,id desc limit 50 loop
   if row.id=any(distinct_ids) then raise exception 'TEST: duplicate ledger entry'; end if;
   distinct_ids:=array_append(distinct_ids,row.id);n:=n+1;cursor_at:=row.created_at;cursor_id:=row.id;
  end loop;
  exit when not found;
 end loop;
 if n<>1100 then raise exception 'TEST: ledger paging'; end if;
 cursor_at:=null;cursor_id:=null;n:=0;distinct_ids:='{}';
 loop
  for row in select id,submitted_at from public.garden_progress where cursor_at is null or (submitted_at,id)<(cursor_at,cursor_id) order by submitted_at desc,id desc limit 50 loop
   if row.id=any(distinct_ids) then raise exception 'TEST: duplicate progress'; end if;
   distinct_ids:=array_append(distinct_ids,row.id);n:=n+1;cursor_at:=row.submitted_at;cursor_id:=row.id;
  end loop;
  exit when not found;
 end loop;
 if n<>1050 then raise exception 'TEST: review paging'; end if;
 begin perform public.garden_task_page(true,false,null,null,50); raise exception 'TEST: non manager access'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
 if (select count(*) from public.garden_profiles)<>3 then raise exception 'TEST: manager profile access'; end if;
 if (select count(*) from public.garden_task_page(true,false,null,null,51))<>51 then raise exception 'TEST: manager task paging'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.player'),true);
 if (select count(*) from public.garden_profiles)<>1 then raise exception 'TEST: profile privacy'; end if;
end $$;
rollback;
