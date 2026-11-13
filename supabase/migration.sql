-- Run once in a dedicated project. All game mutations are transactional RPCs.
create table public.garden_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0)
);
create table public.garden_plots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot integer not null check (slot between 0 and 8),
  assignment_id text not null check (assignment_id in ('carrot','sunflower','lotus')),
  stage integer not null default 0 check (stage between 0 and 2),
  due_at timestamptz not null default (now() + interval '2 days'),
  early boolean not null default false,
  score numeric check (score between 0 and 10),
  mutation text check (mutation in ('Normal','Frozen','Shocked','Gold','Rainbow')),
  harvested boolean not null default false
);
create unique index garden_active_slot on public.garden_plots(user_id, slot) where not harvested;
create table public.garden_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plot_id uuid not null references public.garden_plots(id) on delete cascade,
  stage integer not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  unique(plot_id, stage)
);
alter table public.garden_profiles enable row level security;
alter table public.garden_plots enable row level security;
alter table public.garden_submissions enable row level security;
create policy "own profile" on public.garden_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own plots" on public.garden_plots for select to authenticated using (user_id = (select auth.uid()));
create policy "own submissions" on public.garden_submissions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.garden_profiles, public.garden_plots, public.garden_submissions from anon, authenticated;
grant select on public.garden_profiles, public.garden_plots, public.garden_submissions to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('garden-homework', 'garden-homework', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']);
create policy "garden upload own" on storage.objects for insert to authenticated with check (bucket_id = 'garden-homework' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "garden view own" on storage.objects for select to authenticated using (bucket_id = 'garden-homework' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "garden delete own" on storage.objects for delete to authenticated using (bucket_id = 'garden-homework' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.garden_plant(p_slot integer, p_assignment text) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_slot not between 0 and 8 or p_assignment not in ('carrot','sunflower','lotus') then raise exception 'Invalid request'; end if;
  insert into public.garden_profiles(user_id) values(uid) on conflict do nothing;
  insert into public.garden_plots(user_id,slot,assignment_id) values(uid,p_slot,p_assignment);
end $$;
create function public.garden_submit(p_plot uuid, p_path text) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.garden_plots%rowtype; total integer;
begin
  select * into p from public.garden_plots where id=p_plot and user_id=uid for update;
  if not found or p.harvested or p.score is not null then raise exception 'Plot unavailable'; end if;
  total := case when p.assignment_id='lotus' then 2 else 1 end;
  if p.stage >= total or split_part(p_path,'/',1) <> uid::text or not exists (select 1 from storage.objects where bucket_id='garden-homework' and name=p_path and owner_id=uid::text) then raise exception 'Invalid submission'; end if;
  insert into public.garden_submissions(user_id,plot_id,stage,image_path) values(uid,p.id,p.stage+1,p_path);
  update public.garden_plots set stage=stage+1, early=(case when stage+1=total then now()<due_at else false end) where id=p.id;
end $$;
create function public.garden_grade(p_plot uuid, p_score numeric) returns void language plpgsql security definer set search_path = '' as $$
declare p public.garden_plots%rowtype; m text;
begin
  select * into p from public.garden_plots where id=p_plot and user_id=auth.uid() for update;
  if not found or p.harvested or p.score is not null or p.stage < (case when p.assignment_id='lotus' then 2 else 1 end) or p_score is null or p_score < 0 or p_score > 10 then raise exception 'Cannot grade'; end if;
  m := case when p_score>=9.5 then (case when random()<0.5 then 'Gold' else 'Rainbow' end) when p_score>=8.5 then (case when random()<0.5 then 'Frozen' else 'Shocked' end) else 'Normal' end;
  update public.garden_plots set score=p_score, mutation=m where id=p.id;
end $$;
create function public.garden_harvest(p_plot uuid) returns integer language plpgsql security definer set search_path = '' as $$
declare p public.garden_plots%rowtype; reward integer;
begin
  select * into p from public.garden_plots where id=p_plot and user_id=auth.uid() for update;
  if not found or p.harvested or p.score is null then raise exception 'Cannot harvest'; end if;
  reward := case when p.mutation in ('Gold','Rainbow') then 50 when p.mutation in ('Frozen','Shocked') then 20 else 10 end;
  update public.garden_plots set harvested=true where id=p.id;
  insert into public.garden_profiles(user_id,coins) values(auth.uid(),reward) on conflict(user_id) do update set coins=public.garden_profiles.coins+excluded.coins;
  return reward;
end $$;
revoke all on function public.garden_plant(integer,text), public.garden_submit(uuid,text), public.garden_grade(uuid,numeric), public.garden_harvest(uuid) from public, anon;
grant execute on function public.garden_plant(integer,text), public.garden_submit(uuid,text), public.garden_grade(uuid,numeric), public.garden_harvest(uuid) to authenticated;
