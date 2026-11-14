create or replace function garden_private.watering_submit(plot uuid, question uuid, answer text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid:=auth.uid(); correct boolean; q jsonb;
begin
 u:=garden_private.ensure_profile();
 perform 1 from public.garden_profiles where user_id=u for update;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=clock_timestamp() then raise exception 'Cây không thể tưới lúc này.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if not found or s.question_data is null or s.question_id<>question then raise exception 'Lượt tưới đã kết thúc hoặc câu hỏi đã thay đổi.'; end if;
 if answer is null or length(btrim(answer)) not between 1 and 500 then raise exception 'Đáp án không hợp lệ.'; end if;
 if s.expires_at<=clock_timestamp() then
  update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
  delete from garden_private.watering_sessions where plot_id=plot;
  return jsonb_build_object('expired',true);
 end if;
 correct:=lower(btrim(answer))=lower(btrim(s.question_data->>'answer'));
 if not correct then
  update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
  delete from garden_private.watering_sessions where plot_id=plot;
  return jsonb_build_object('correct',false,'finished',true);
 end if;
 if correct then
  update public.garden_plots set ready_at=greatest(clock_timestamp(),ready_at-interval '5 minutes') where id=plot returning * into p;
  update public.garden_profiles set xp=xp+10 where user_id=u;
  if p.ready_at<=clock_timestamp() then
   delete from garden_private.watering_sessions where plot_id=plot;
   return jsonb_build_object('correct',true,'finished',true,'ready',true,'xp_awarded',10);
  end if;
 end if;
 q:=garden_private.next_watering_question((s.question_data->>'bank_id')::uuid);
 if q is null then
  update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
  delete from garden_private.watering_sessions where plot_id=plot;
  return jsonb_build_object('correct',correct,'finished',true,'xp_awarded',10);
 end if;
 update garden_private.watering_sessions set question_id=gen_random_uuid(),question_data=q,
  solved=solved+case when correct then 1 else 0 end where plot_id=plot returning * into s;
 return garden_private.watering_public_question(s)||jsonb_build_object('correct',correct,'solved',s.solved,'xp_awarded',10);
end $$;
