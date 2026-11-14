create or replace function garden_private.valid_files(paths text[], bucket text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(
    cardinality(paths) between 1 and case when bucket='garden-homework' then 10 else 5 end
    and not exists (
      select 1 from unnest(paths) p
      where p is null
        or split_part(p,'/',1)<>auth.uid()::text
        or not exists (
          select 1 from storage.objects o
          where o.bucket_id=bucket and o.name=p and o.owner_id=auth.uid()::text
        )
    ), false
  );
$$;

create or replace function garden_private.submit_task(task uuid, files text[])
returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid:=garden_private.ensure_profile();
  t public.garden_tasks%rowtype;
  p public.garden_progress%rowtype;
begin
  perform 1 from public.garden_profiles where user_id=u for update;
  select * into t from public.garden_tasks where id=task and status='published';
  if not found then raise exception 'Nhiệm vụ chưa mở hoặc đã ẩn.'; end if;
  if not garden_private.valid_files(files,'garden-homework') then
    raise exception 'Hãy nộp từ 1 đến 10 ảnh bài làm hợp lệ.';
  end if;
  insert into public.garden_progress(user_id,task_id,status,reward_snapshot)
    values(u,task,'returned',t.reward) on conflict(user_id,task_id) do nothing;
  select * into p from public.garden_progress where user_id=u and task_id=task for update;
  if p.status in ('submitted','approved') then raise exception 'Bài này đã nộp hoặc đã hoàn thành.'; end if;
  update public.garden_progress set status='submitted',submitted_at=now(),reward_snapshot=t.reward where id=p.id;
  insert into public.garden_attempts(progress_id,user_id,files) values(p.id,u,files);
end;
$$;

revoke execute on function garden_private.valid_files(text[],text), garden_private.submit_task(uuid,text[]) from public,anon;
grant execute on function garden_private.valid_files(text[],text), garden_private.submit_task(uuid,text[]) to authenticated;
