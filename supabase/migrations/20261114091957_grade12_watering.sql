create table garden_private.question_bank (
 id uuid primary key default gen_random_uuid(),
 topic text not null,
 prompt text not null,
 kind text not null check (kind in ('choice','short')),
 options jsonb,
 answer text not null,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table garden_private.question_imports (
 request_id uuid primary key,
 actor_id uuid not null,
 count integer not null
);
revoke all on garden_private.question_bank, garden_private.question_imports from public,anon,authenticated;
alter table garden_private.watering_sessions add column question_data jsonb;
update garden_private.watering_sessions set question_id=gen_random_uuid();

create function garden_private.import_questions(items jsonb, request uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare item jsonb; idx integer:=0; result integer; k text; opts jsonb; ans text;
begin
 perform garden_private.require_manager();
 if request is null then raise exception 'Thiếu mã nhập câu hỏi.'; end if;
 select count into result from garden_private.question_imports where request_id=request and actor_id=auth.uid();
 if found then return result; end if;
 if jsonb_typeof(items) is distinct from 'array' then raise exception 'Tệp cần là một mảng câu hỏi.'; end if;
 if jsonb_array_length(items) not between 1 and 500 then raise exception 'Tệp cần có từ 1 đến 500 câu hỏi.'; end if;
 for item in select value from jsonb_array_elements(items) loop
  idx:=idx+1; k:=item->>'type'; opts:=item->'options'; ans:=btrim(item->>'answer');
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'question') is distinct from 'string' or jsonb_typeof(item->'answer') is distinct from 'string' or coalesce(length(btrim(item->>'question')),0) not between 1 and 4000
   or coalesce(length(btrim(item->>'topic')),0)>100 or k is null or k not in ('choice','short')
   or coalesce(length(ans),0) not between 1 and 500 then raise exception 'Câu %: nội dung, loại hoặc đáp án không hợp lệ.',idx; end if;
  if k='choice' then
   if jsonb_typeof(opts) is distinct from 'array' or jsonb_array_length(opts)<>4 then raise exception 'Câu %: cần đúng 4 lựa chọn.',idx; end if;
   if exists(select 1 from jsonb_array_elements(opts) o where jsonb_typeof(o)<>'string' or length(btrim(o#>>'{}')) not between 1 and 1000) or ans not in ('A','B','C','D') then
    raise exception 'Câu %: lựa chọn không hợp lệ hoặc đáp án không phải A, B, C, D.',idx;
   end if;
  elsif opts is not null and opts <> 'null'::jsonb then raise exception 'Câu %: câu trả lời ngắn không có lựa chọn.',idx;
  end if;
  insert into garden_private.question_bank(topic,prompt,kind,options,answer)
  values(coalesce(btrim(item->>'topic'),''),btrim(item->>'question'),k,case when k='choice' then opts else null end,ans);
 end loop;
 insert into garden_private.question_imports values(request,auth.uid(),idx);
 return idx;
end $$;

create function garden_private.list_questions() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform garden_private.require_manager();
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc) from
  (select id,topic,prompt,kind,options,answer,active,created_at from garden_private.question_bank order by created_at desc,id desc limit 500) q),'[]'::jsonb);
end $$;
create function garden_private.set_question_active(question uuid, enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform garden_private.require_manager();
 if question is null or enabled is null then raise exception 'Câu hỏi không hợp lệ.'; end if;
 update garden_private.question_bank set active=enabled where id=question;
 if not found then raise exception 'Không tìm thấy câu hỏi.'; end if;
end $$;

create function garden_private.next_watering_question(previous uuid default null) returns jsonb language plpgsql volatile set search_path='' as $$
declare q garden_private.question_bank%rowtype;
begin
 select * into q from garden_private.question_bank where active and (id<>previous or previous is null)
  order by random() limit 1;
 if not found then select * into q from garden_private.question_bank where active order by random() limit 1; end if;
 if not found then return null; end if;
 return jsonb_build_object('bank_id',q.id,'topic',q.topic,'prompt',q.prompt,'type',q.kind,'options',q.options,'answer',q.answer);
end $$;
create function garden_private.watering_public_question(s garden_private.watering_sessions) returns jsonb language sql immutable set search_path='' as $$
 select (s.question_data - 'answer' - 'bank_id') || jsonb_build_object('id',s.question_id,'solved',s.solved)
$$;

create or replace function garden_private.watering_start(plot uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; q jsonb; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=now() then raise exception 'Cây không thể tưới lúc này.'; end if;
 if p.next_water_at>now() then raise exception 'Cây chưa cần tưới.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot;
 if not found or s.question_data is null then
  q:=garden_private.next_watering_question();
  if q is null then raise exception 'Ngân hàng câu hỏi đang trống. Hãy liên hệ người quản lý.'; end if;
  insert into garden_private.watering_sessions(plot_id,a,b,operation,question_data) values(plot,0,0,'bank',q)
   on conflict(plot_id) do update set question_data=excluded.question_data,question_id=gen_random_uuid() returning * into s;
 end if;
 return garden_private.watering_public_question(s);
end $$;

create function garden_private.watering_submit(plot uuid, question uuid, answer text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.garden_plots%rowtype; s garden_private.watering_sessions%rowtype; u uuid:=auth.uid(); correct boolean; q jsonb;
begin
 if u is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into p from public.garden_plots where id=plot and user_id=u and not harvested for update;
 if not found or p.ready_at<=now() then raise exception 'Cây không thể tưới lúc này.'; end if;
 select * into s from garden_private.watering_sessions where plot_id=plot for update;
 if not found or s.question_data is null or s.question_id<>question then raise exception 'Câu hỏi đã thay đổi. Hãy mở lại lượt tưới.'; end if;
 if answer is null or length(btrim(answer)) not between 1 and 500 then raise exception 'Đáp án không hợp lệ.'; end if;
 correct:=lower(btrim(answer))=lower(btrim(s.question_data->>'answer'));
 if correct then
  update public.garden_plots set ready_at=greatest(now(),ready_at-interval '1 minute') where id=plot;
  q:=garden_private.next_watering_question((s.question_data->>'bank_id')::uuid);
  update garden_private.watering_sessions set question_id=gen_random_uuid(),question_data=q,solved=solved+1 where plot_id=plot returning * into s;
  if q is null then return jsonb_build_object('correct',true,'solved',s.solved,'empty',true); end if;
 end if;
 return garden_private.watering_public_question(s)||jsonb_build_object('correct',correct);
end $$;

create function public.garden_import_questions(p_items jsonb,p_request uuid) returns integer language sql security invoker set search_path='' as $$ select garden_private.import_questions(p_items,p_request) $$;
create function public.garden_list_questions() returns jsonb language sql security invoker set search_path='' as $$ select garden_private.list_questions() $$;
create function public.garden_set_question_active(p_question uuid,p_enabled boolean) returns void language sql security invoker set search_path='' as $$ select garden_private.set_question_active(p_question,p_enabled) $$;
create function public.garden_watering_submit(p_plot uuid,p_question uuid,p_answer text) returns jsonb language sql security invoker set search_path='' as $$ select garden_private.watering_submit(p_plot,p_question,p_answer) $$;
revoke all on function garden_private.next_watering_question(uuid),garden_private.watering_public_question(garden_private.watering_sessions),garden_private.import_questions(jsonb,uuid),garden_private.list_questions(),garden_private.set_question_active(uuid,boolean),garden_private.watering_submit(uuid,uuid,text),public.garden_import_questions(jsonb,uuid),public.garden_list_questions(),public.garden_set_question_active(uuid,boolean),public.garden_watering_submit(uuid,uuid,text),public.garden_watering_answer(uuid,uuid,integer),garden_private.watering_answer(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function garden_private.import_questions(jsonb,uuid),garden_private.list_questions(),garden_private.set_question_active(uuid,boolean),garden_private.watering_submit(uuid,uuid,text),public.garden_import_questions(jsonb,uuid),public.garden_list_questions(),public.garden_set_question_active(uuid,boolean),public.garden_watering_submit(uuid,uuid,text) to authenticated;
