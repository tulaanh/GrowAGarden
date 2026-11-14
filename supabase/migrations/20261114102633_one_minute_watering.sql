alter table garden_private.watering_sessions add column expires_at timestamptz not null default clock_timestamp();

create or replace function garden_private.watering_public_question(s garden_private.watering_sessions) returns jsonb
language sql immutable set search_path='' as $$
 select (s.question_data - 'answer' - 'bank_id') || jsonb_build_object('id',s.question_id,'expires_at',s.expires_at)
$$;

create or replace function garden_private.watering_start(plot uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; q jsonb; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=clock_timestamp() then raise exception 'Cây không thể tưới lúc này.'; end if;
 if p.next_water_at>clock_timestamp() then raise exception 'Cây chưa cần tưới.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if found and s.expires_at<=clock_timestamp() then
  update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
  delete from garden_private.watering_sessions where plot_id=plot;
  return jsonb_build_object('expired',true);
 end if;
 if s.plot_id is null then
  q:=garden_private.next_watering_question();
  if q is null then raise exception 'Ngân hàng câu hỏi đang trống. Hãy liên hệ người quản lý.'; end if;
  insert into garden_private.watering_sessions(plot_id,a,b,operation,question_data,expires_at)
  values(plot,0,0,'bank',q,clock_timestamp()+interval '1 minute') returning * into s;
 end if;
 return garden_private.watering_public_question(s);
end $$;

create or replace function garden_private.watering_submit(plot uuid, question uuid, answer text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid:=auth.uid(); correct boolean; expired boolean;
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=clock_timestamp() then raise exception 'Cây không thể tưới lúc này.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if not found or s.question_data is null or s.question_id<>question then raise exception 'Lượt tưới đã kết thúc hoặc câu hỏi đã thay đổi.'; end if;
 if answer is null or length(btrim(answer)) not between 1 and 500 then raise exception 'Đáp án không hợp lệ.'; end if;
 expired:=s.expires_at<=clock_timestamp();
 correct:=not expired and lower(btrim(answer))=lower(btrim(s.question_data->>'answer'));
 update public.garden_plots set ready_at=case when correct then greatest(clock_timestamp(),ready_at-interval '1 minute') else ready_at end,
  next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
 delete from garden_private.watering_sessions where plot_id=plot;
 return jsonb_build_object('correct',correct,'expired',expired);
end $$;

create or replace function garden_private.watering_finish(plot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found then raise exception 'Không tìm thấy cây.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if not found then return; end if;
 if s.expires_at>clock_timestamp() then raise exception 'Lượt tưới chưa hết giờ.'; end if;
 update public.garden_plots set next_water_at=clock_timestamp()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
 delete from garden_private.watering_sessions where plot_id=plot;
end $$;
