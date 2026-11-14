create or replace function garden_private.watering_submit(plot uuid, question uuid, answer text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid:=auth.uid(); correct boolean; q jsonb;
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
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
 if correct then
  update public.garden_plots set ready_at=greatest(clock_timestamp(),ready_at-interval '1 minute') where id=plot;
 end if;
 q:=garden_private.next_watering_question((s.question_data->>'bank_id')::uuid);
 if q is null then
  update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
  delete from garden_private.watering_sessions where plot_id=plot;
  return jsonb_build_object('correct',correct,'finished',true);
 end if;
 update garden_private.watering_sessions set question_id=gen_random_uuid(),question_data=q,
  expires_at=expires_at+case when correct then interval '15 seconds' else interval '0 seconds' end,
  solved=solved+case when correct then 1 else 0 end where plot_id=plot returning * into s;
 return garden_private.watering_public_question(s)||jsonb_build_object('correct',correct,'solved',s.solved);
end $$;

create or replace function garden_private.watering_finish(plot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found then raise exception 'Không tìm thấy cây.'; end if;
 if not exists(select 1 from garden_private.watering_sessions where plot_id=plot) then return; end if;
 update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
 delete from garden_private.watering_sessions where plot_id=plot;
end $$;
