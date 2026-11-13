begin;
do $$
declare teacher uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); other_student uuid:=gen_random_uuid(); task uuid; task2 uuid; progress uuid; plot uuid; request uuid:=gen_random_uuid(); balance integer; reward integer;
begin
 delete from public.garden_seed_drops where seed_id='gacha_common' and plant_id<>'carrot';
 insert into auth.users(id,aud,role,email) values(teacher,'authenticated','authenticated',teacher||'@example.invalid'),(student,'authenticated','authenticated',student||'@example.invalid'),(other_student,'authenticated','authenticated',other_student||'@example.invalid');
 insert into garden_private.managers values(teacher);
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 task:=public.garden_save_task(null,'Integration check','Bài tập thử',now()-interval '1 hour',20,'published','{}');
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.garden_initialize();
 begin
  perform public.garden_save_task(null,'Forbidden','',null,20,'published','{}');
  raise exception 'TEST: student could manage tasks';
 exception when raise_exception then if sqlerrm='TEST: student could manage tasks' then raise; end if; end;
 begin
  perform public.garden_buy('gacha_common',1,gen_random_uuid());
  raise exception 'TEST: purchase without coins';
 exception when raise_exception then if sqlerrm='TEST: purchase without coins' then raise; end if; end;
 insert into storage.objects(bucket_id,name,owner_id) values('garden-homework',student||'/test.png',student::text);
 perform public.garden_submit_task(task,array[student||'/test.png']);
 select id into progress from public.garden_progress where user_id=student and task_id=task;
 if (select coins from public.garden_profiles where user_id=student)<>0 then raise exception 'TEST: submission paid before review'; end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform public.garden_review(progress,false,'Bổ sung bài',0);
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.garden_submit_task(task,array[student||'/test.png']);
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform public.garden_review(progress,true,'Làm tốt',10);
 begin
  perform public.garden_review(progress,true,'Repeat',10);
  raise exception 'TEST: repeated approval';
 exception when raise_exception then if sqlerrm='TEST: repeated approval' then raise; end if; end;
 begin
  perform public.garden_bonus(progress,10,'Repeat');
  raise exception 'TEST: repeated bonus';
 exception when raise_exception then if sqlerrm='TEST: repeated bonus' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',student::text,true);
 if (select coins from public.garden_profiles where user_id=student)<>30 then raise exception 'TEST: incorrect rewards'; end if;
 perform public.garden_buy('gacha_common',1,request);
 perform public.garden_buy('gacha_common',1,request);
 if (select coins from public.garden_profiles where user_id=student)<>20 then raise exception 'TEST: repeated purchase request'; end if;
 begin
  perform public.garden_buy('gacha_rare',1,gen_random_uuid());
  raise exception 'TEST: ignored level lock';
 exception when raise_exception then if sqlerrm='TEST: ignored level lock' then raise; end if; end;
 perform public.garden_plant(0,'gacha_common');
 select id,xp_reward into plot,reward from public.garden_plots where user_id=student and not harvested;
 begin
  perform public.garden_harvest(plot);
  raise exception 'TEST: early harvest';
 exception when raise_exception then if sqlerrm='TEST: early harvest' then raise; end if; end;
 perform public.garden_buy('fertilizer',1,gen_random_uuid());
 perform public.garden_fertilize(plot);
 balance:=(select coins from public.garden_profiles where user_id=student);
 perform public.garden_harvest(plot);
 if (select xp from public.garden_profiles where user_id=student)<>reward or (select coins from public.garden_profiles where user_id=student)<>balance then raise exception 'TEST: incorrect harvest reward'; end if;
 begin
  perform public.garden_harvest(plot);
  raise exception 'TEST: repeated harvest';
 exception when raise_exception then if sqlerrm='TEST: repeated harvest' then raise; end if; end;
 if (select quantity from public.garden_collection where user_id=student and seed_id='carrot')<>1 then raise exception 'TEST: incorrect collection'; end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 task2:=public.garden_save_task(null,'Second check','',null,20,'published','{}');
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.garden_submit_task(task2,array[student||'/test.png']);
 select id into progress from public.garden_progress where user_id=student and task_id=task2;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform public.garden_review(progress,true,'Đã xong',0);
 perform public.garden_bonus(progress,5,'Tặng sau khi duyệt');
 perform public.garden_save_catalog('carrot',10,3600,999,1,60,true);
 if (select xp_reward from public.garden_plots where id=plot)<>20 then raise exception 'TEST: catalog edit changed planted XP'; end if;
 update public.garden_profiles set xp=100 where user_id=student;
 perform set_config('request.jwt.claim.sub',student::text,true);
 perform public.garden_buy('gacha_rare',1,gen_random_uuid());
end $$;
rollback;
