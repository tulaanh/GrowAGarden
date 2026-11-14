create index garden_plots_discovery_idx on public.garden_plots(user_id, seed_id)
where source_seed_id in ('gacha_common', 'gacha_rare', 'gacha_special');

create function public.garden_discovered_seeds() returns text[]
language sql stable security invoker set search_path = '' as $$
  select array(
    select id from (
      select unnest(array['carrot','rice']) as id
      union
      select seed_id from public.garden_plots
      where user_id = (select auth.uid())
        and source_seed_id in ('gacha_common','gacha_rare','gacha_special')
    ) discoveries order by id
  );
$$;
revoke all on function public.garden_discovered_seeds() from public, anon;
grant execute on function public.garden_discovered_seeds() to authenticated;

drop policy "own profile" on public.garden_profiles;
drop policy "manager profiles" on public.garden_profiles;
create policy "profile read" on public.garden_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select garden_private.is_manager()));

create function public.garden_task_page(
  p_manage boolean default false,
  p_open boolean default false,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 51
) returns setof public.garden_tasks
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
  if p_manage and not garden_private.is_manager() then raise exception 'Chỉ quản lý được thực hiện thao tác này.'; end if;
  if p_limit is null or p_limit not between 1 and 100
    or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'Phân trang không hợp lệ.';
  end if;
  return query
    select t.* from public.garden_tasks t
    where (p_manage or t.status = 'published' or exists (
      select 1 from public.garden_progress p where p.task_id=t.id and p.user_id=(select auth.uid())
    ))
    and (not p_open or not exists (
      select 1 from public.garden_progress p where p.task_id=t.id and p.user_id=(select auth.uid()) and p.status='approved'
    ))
    and (p_before_at is null or (t.created_at,t.id) < (p_before_at,p_before_id))
    order by t.created_at desc,t.id desc limit p_limit;
end;
$$;
revoke all on function public.garden_task_page(boolean,boolean,timestamptz,uuid,integer) from public,anon;
grant execute on function public.garden_task_page(boolean,boolean,timestamptz,uuid,integer) to authenticated;
