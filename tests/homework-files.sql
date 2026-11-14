begin;
do $$
declare
  teacher uuid:=gen_random_uuid();
  student uuid:=gen_random_uuid();
  other_student uuid:=gen_random_uuid();
  task uuid;
  progress uuid;
  paths text[];
  task_paths text[];
begin
  insert into auth.users(id,aud,role,email) values
    (teacher,'authenticated','authenticated',teacher||'@example.invalid'),
    (student,'authenticated','authenticated',student||'@example.invalid'),
    (other_student,'authenticated','authenticated',other_student||'@example.invalid');
  insert into garden_private.managers values(teacher);
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  task:=public.garden_save_task(null,'Ten homework photos','',null,20,'published','{}');
  select array_agg(teacher||'/task-'||n||'.jpg' order by n) into task_paths from generate_series(1,6) n;
  insert into storage.objects(bucket_id,name,owner_id)
    select 'garden-task-files',path,teacher::text from unnest(task_paths) path;
  if not garden_private.valid_files(task_paths[1:5],'garden-task-files')
    or garden_private.valid_files(task_paths,'garden-task-files') then
    raise exception 'TEST: task attachment limit changed';
  end if;

  perform set_config('request.jwt.claim.sub',student::text,true);
  perform public.garden_initialize();
  select array_agg(student||'/photo-'||n||'.jpg' order by n) into paths from generate_series(1,11) n;
  insert into storage.objects(bucket_id,name,owner_id)
    select 'garden-homework',path,student::text from unnest(paths) path;
  if garden_private.valid_files('{}','garden-homework')
    or garden_private.valid_files(null,'garden-homework')
    or garden_private.valid_files(array[null]::text[],'garden-homework')
    or garden_private.valid_files(array[student||'/missing.jpg'],'garden-homework') then
    raise exception 'TEST: invalid homework accepted';
  end if;
  begin
    perform public.garden_submit_task(task,paths);
    raise exception 'TEST: eleven photos accepted';
  exception when raise_exception then
    if sqlerrm<>'Hãy nộp từ 1 đến 10 ảnh bài làm hợp lệ.' then raise; end if;
  end;
  if exists(select 1 from public.garden_progress where task_id=task and user_id=student) then
    raise exception 'TEST: invalid batch changed progress';
  end if;
  perform set_config('request.jwt.claim.sub',other_student::text,true);
  if garden_private.valid_files(paths[1:10],'garden-homework') then
    raise exception 'TEST: another student can submit these photos';
  end if;
  perform set_config('request.jwt.claim.sub',student::text,true);
  update storage.objects set owner_id=other_student::text where name=paths[1];
  if garden_private.valid_files(paths[1:10],'garden-homework') then
    raise exception 'TEST: file owner check bypassed';
  end if;
  update storage.objects set owner_id=student::text where name=paths[1];
  perform public.garden_submit_task(task,paths[1:10]);
  select id into progress from public.garden_progress where task_id=task and user_id=student and status='submitted';
  if progress is null or not exists(select 1 from public.garden_attempts where progress_id=progress and files=paths[1:10]) then
    raise exception 'TEST: ten-photo submission incomplete';
  end if;
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  perform public.garden_review(progress,false,'Chụp lại trang cuối',0);
  perform set_config('request.jwt.claim.sub',student::text,true);
  perform public.garden_submit_task(task,paths[1:10]);
  if (select count(*) from public.garden_attempts where progress_id=progress)<>2 then
    raise exception 'TEST: ten-photo resubmission failed';
  end if;
end;
$$;
rollback;
