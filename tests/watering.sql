begin;
do $$
declare manager uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); plot uuid:=gen_random_uuid(); q jsonb; result jsonb; before_ready timestamptz; bank_id uuid; req uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email) values(manager,'authenticated','authenticated',manager||'@test.invalid'),(u,'authenticated','authenticated',u||'@test.invalid'),(other_user,'authenticated','authenticated',other_user||'@test.invalid');
 insert into garden_private.managers values(manager);
 insert into public.garden_plots(id,user_id,slot,seed_id,planted_at,ready_at,growth_seconds,xp_reward,next_water_at)
 values(plot,u,0,'carrot',now(),now()+interval '30 minutes',1800,20,now()-interval '1 second');
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin
  perform public.garden_watering_start(plot);
  raise exception 'TEST: empty bank accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_import_questions('[{"question":"x","type":"short","answer":"1"}]',gen_random_uuid());
  raise exception 'TEST: student imported questions';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 begin
  perform public.garden_import_questions('[{"question":"Valid","type":"short","answer":"1"},{"question":"Invalid","type":"choice","options":["one"],"answer":"A"}]',gen_random_uuid());
  raise exception 'TEST: invalid import accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 if exists(select 1 from garden_private.question_bank) then raise exception 'TEST: partial import'; end if;
 if public.garden_import_questions('[{"topic":"Toán 12","question":"Tính 1 + 1","type":"short","answer":"2"}]',req)<>1 then raise exception 'TEST: import count'; end if;
 perform public.garden_import_questions('[{"topic":"Toán 12","question":"Tính 1 + 1","type":"short","answer":"2"}]',req);
 if (select count(*) from garden_private.question_bank)<>1 then raise exception 'TEST: duplicate import'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 q:=public.garden_watering_start(plot);
 if q->>'prompt'<>'Tính 1 + 1' or q ? 'answer' or q->>'id'<>public.garden_watering_start(plot)->>'id' or (q->>'expires_at')::timestamptz - (q->>'server_now')::timestamptz not between interval '59 seconds' and interval '60 seconds' then raise exception 'TEST: question snapshot or deadline'; end if;
 select ready_at into before_ready from public.garden_plots where id=plot;
 result:=public.garden_watering_submit(plot,(q->>'id')::uuid,'3');
 if (result->>'correct')::boolean or not (result->>'finished')::boolean or exists(select 1 from garden_private.watering_sessions where plot_id=plot) or (select ready_at from public.garden_plots where id=plot)<>before_ready or (select next_water_at from public.garden_plots where id=plot)<=clock_timestamp() then raise exception 'TEST: wrong answer did not end session'; end if;
 begin
  perform public.garden_watering_submit(plot,(q->>'id')::uuid,'2');
  raise exception 'TEST: second attempt accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_watering_start(plot);
  raise exception 'TEST: restarted watering early';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 update public.garden_plots set next_water_at=clock_timestamp()-interval '1 second' where id=plot;
 q:=public.garden_watering_start(plot);
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 begin
  perform public.garden_watering_submit(plot,(q->>'id')::uuid,'2');
  raise exception 'TEST: other user accessed plot';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 result:=public.garden_watering_submit(plot,(q->>'id')::uuid,' 2 ');
 if not (result->>'correct')::boolean or (result->>'expires_at')::timestamptz<>(q->>'expires_at')::timestamptz+interval '15 seconds' or (select ready_at from public.garden_plots where id=plot)<>before_ready-interval '1 minute' then raise exception 'TEST: correct answer bonus'; end if;
 if (public.garden_watering_start(plot)->>'expires_at')::timestamptz<>(result->>'expires_at')::timestamptz then raise exception 'TEST: reopened session deadline changed'; end if;
 perform public.garden_watering_finish(plot);
 if exists(select 1 from garden_private.watering_sessions where plot_id=plot) or (select next_water_at from public.garden_plots where id=plot)<=clock_timestamp() then raise exception 'TEST: manual finish'; end if;
 update public.garden_plots set next_water_at=now()-interval '1 second' where id=plot;
 q:=public.garden_watering_start(plot);
 update garden_private.watering_sessions set expires_at=clock_timestamp()-interval '1 second' where plot_id=plot;
 select ready_at into before_ready from public.garden_plots where id=plot;
 result:=public.garden_watering_submit(plot,(q->>'id')::uuid,'2');
 if not (result->>'expired')::boolean or (select ready_at from public.garden_plots where id=plot)<>before_ready then raise exception 'TEST: expired answer rewarded'; end if;
 update public.garden_plots set next_water_at=now()-interval '1 second' where id=plot;
 q:=public.garden_watering_start(plot);
 update garden_private.watering_sessions set expires_at=clock_timestamp()-interval '1 second' where plot_id=plot;
 result:=public.garden_watering_start(plot);
 if not (result->>'expired')::boolean or exists(select 1 from garden_private.watering_sessions where plot_id=plot) or (select next_water_at from public.garden_plots where id=plot)<=clock_timestamp() then raise exception 'TEST: expired session restarted'; end if;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 select id into bank_id from garden_private.question_bank limit 1;
 perform public.garden_set_question_active(bank_id,false);
 perform public.garden_import_questions('[{"question":"Chọn đáp án đúng","type":"choice","options":["1","2","3","4"],"answer":"B"}]',gen_random_uuid());
 update public.garden_plots set next_water_at=now()-interval '1 second' where id=plot;
 perform set_config('request.jwt.claim.sub',u::text,true);
 q:=public.garden_watering_start(plot);
 if q->>'type'<>'choice' or jsonb_array_length(q->'options')<>4 or q ? 'answer' then raise exception 'TEST: choice question'; end if;
 result:=public.garden_watering_submit(plot,(q->>'id')::uuid,'b');
 if not (result->>'correct')::boolean then raise exception 'TEST: choice answer'; end if;
end $$;
rollback;
