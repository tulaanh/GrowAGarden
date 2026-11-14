alter table public.garden_plots add column next_water_at timestamptz;
update public.garden_plots set next_water_at = planted_at + make_interval(secs => 300 + floor(random()*301)::integer);
alter table public.garden_plots alter column next_water_at set default (now() + make_interval(secs => 300 + floor(random()*301)::integer));
alter table public.garden_plots alter column next_water_at set not null;

create table garden_private.watering_sessions (
 plot_id uuid primary key references public.garden_plots(id) on delete cascade,
 question_id uuid not null default gen_random_uuid(),
 a integer not null,
 b integer not null,
 operation text not null,
 solved integer not null default 0
);
revoke all on garden_private.watering_sessions from public, anon, authenticated;

create function garden_private.watering_start(plot uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid := auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=now() then raise exception 'Cây không thể tưới lúc này.'; end if;
 if p.next_water_at>now() then raise exception 'Cây chưa cần tưới.'; end if;
 insert into garden_private.watering_sessions(plot_id,a,b,operation)
 values(plot,1+floor(random()*20)::integer,1+floor(random()*20)::integer,case when random()<0.5 then '+' else '×' end)
 on conflict(plot_id) do nothing;
 select * into s from garden_private.watering_sessions where plot_id=plot;
 return jsonb_build_object('id',s.question_id,'a',s.a,'b',s.b,'operation',s.operation,'solved',s.solved);
end $$;

create function garden_private.watering_answer(plot uuid, question uuid, answer integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid := auth.uid(); correct boolean;
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=now() then raise exception 'Cây không thể tưới lúc này.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if not found or s.question_id<>question then raise exception 'Câu hỏi đã thay đổi. Hãy mở lại lượt tưới.'; end if;
 correct := answer is not null and answer = case when s.operation='+' then s.a+s.b else s.a*s.b end;
 if correct then
  update public.garden_plots set ready_at=greatest(now(),ready_at-interval '1 minute') where id=plot;
  update garden_private.watering_sessions set question_id=gen_random_uuid(),a=1+floor(random()*20)::integer,
   b=1+floor(random()*20)::integer,operation=case when random()<0.5 then '+' else '×' end,solved=solved+1
   where plot_id=plot returning * into s;
 end if;
 return jsonb_build_object('correct',correct,'id',s.question_id,'a',s.a,'b',s.b,'operation',s.operation,'solved',s.solved);
end $$;

create function garden_private.watering_finish(plot uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid := auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found then raise exception 'Không tìm thấy cây.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if not found or s.solved<1 then raise exception 'Hãy giải ít nhất một câu trước khi tưới xong.'; end if;
 update public.garden_plots set next_water_at=now()+make_interval(secs=>300+floor(random()*301)::integer) where id=plot;
 delete from garden_private.watering_sessions where plot_id=plot;
end $$;

create function public.garden_watering_start(p_plot uuid) returns jsonb language sql security invoker set search_path='' as $$ select garden_private.watering_start(p_plot) $$;
create function public.garden_watering_answer(p_plot uuid,p_question uuid,p_answer integer) returns jsonb language sql security invoker set search_path='' as $$ select garden_private.watering_answer(p_plot,p_question,p_answer) $$;
create function public.garden_watering_finish(p_plot uuid) returns void language sql security invoker set search_path='' as $$ select garden_private.watering_finish(p_plot) $$;
revoke all on function garden_private.watering_start(uuid),garden_private.watering_answer(uuid,uuid,integer),garden_private.watering_finish(uuid),public.garden_watering_start(uuid),public.garden_watering_answer(uuid,uuid,integer),public.garden_watering_finish(uuid) from public,anon;
grant execute on function garden_private.watering_start(uuid),garden_private.watering_answer(uuid,uuid,integer),garden_private.watering_finish(uuid),public.garden_watering_start(uuid),public.garden_watering_answer(uuid,uuid,integer),public.garden_watering_finish(uuid) to authenticated;
