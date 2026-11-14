import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('homework migration accepts ten owned photos, rejects eleven and preserves file ownership and task attachment limits', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, aud text, role text, email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
      grant usage on schema storage to authenticated,anon;
      grant select,insert,delete on storage.objects to authenticated;
      grant execute on function storage.foldername(text) to authenticated;
    `);
    for (const file of [
      'supabase/migration.sql',
      'supabase/economy-v2.sql',
      'supabase/migrations/20261114141414_increase_homework_photo_limit.sql',
      'tests/homework-files.sql',
    ]) await db.exec(await readFile(file, 'utf8'));
    const privileges = await db.query(`select
      has_function_privilege('anon','garden_private.valid_files(text[],text)','EXECUTE') as anon_valid,
      has_function_privilege('anon','garden_private.submit_task(uuid,text[])','EXECUTE') as anon_submit,
      has_function_privilege('authenticated','garden_private.submit_task(uuid,text[])','EXECUTE') as student_submit`);
    assert.deepEqual(privileges.rows[0], { anon_valid: false, anon_submit: false, student_submit: true });
  } finally { await db.close(); }
});
