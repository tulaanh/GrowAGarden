import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migrations and transactional SQL fixtures on local Postgres', async t => {
 const db = await PGlite.create();
 try {
  await db.exec(`create role anon; create role authenticated;
   create schema auth; create table auth.users(id uuid primary key, aud text, role text, email text);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
   alter table storage.objects enable row level security;
   create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
   grant usage on schema storage to authenticated,anon; grant select,insert,delete on storage.objects to authenticated; grant execute on function storage.foldername(text) to authenticated;`);
  const migrations=['supabase/migration.sql','supabase/economy-v2.sql','supabase/admin-cheats.sql',
   'supabase/migrations/20261112132736_gacha_growth_stages.sql','supabase/migrations/20261112164437_tropical_crop_assets.sql',
   'supabase/migrations/20261113110115_expand_grass_planting.sql','supabase/migrations/20261113154419_finite_garden_unlocks.sql',
   'supabase/migrations/20261113155941_sixteen_planting_slots.sql','supabase/migrations/20261113164956_direct_seed_purchases.sql',
   'supabase/migrations/20261113165508_seed_discovery_unlocks.sql','supabase/migrations/20261114051020_scoped_game_reads.sql',
   'supabase/migrations/20261114090820_watering_math.sql','supabase/migrations/20261114091957_grade12_watering.sql',
   'supabase/migrations/20261114095954_diversify_growth_times.sql',
   'supabase/migrations/20261114102633_one_minute_watering.sql',
   'supabase/migrations/20261114102951_watering_server_clock.sql',
   'supabase/migrations/20261114103125_watering_quiz_bonus_time.sql',
   'supabase/migrations/20261114104039_end_watering_on_wrong_answer.sql'];
  let beforePlan;
  for (const file of migrations) {
   if (file.includes('scoped_game_reads')) {
    await db.exec(`insert into auth.users(id,aud,role,email) values('00000000-0000-0000-0000-000000000001','authenticated','authenticated','perf@test.invalid'),('00000000-0000-0000-0000-000000000002','authenticated','authenticated','perf2@test.invalid');
     insert into public.garden_plots(user_id,slot,seed_id,source_seed_id,planted_at,ready_at,growth_seconds,xp_reward,harvested)
     select '00000000-0000-0000-0000-000000000001',0,'tomato',case when i%2=0 then 'gacha_common' else 'carrot' end,now(),now(),60,20,true from generate_series(1,100) i;
     insert into public.garden_plots(user_id,slot,seed_id,source_seed_id,planted_at,ready_at,growth_seconds,xp_reward,harvested) select '00000000-0000-0000-0000-000000000002',0,'tomato',case when i%2=0 then 'gacha_common' else 'carrot' end,now(),now(),60,20,true from generate_series(1,5000) i;
     analyze public.garden_plots; set enable_seqscan=off;`);
    beforePlan=await db.query(`explain (format json) select distinct seed_id from public.garden_plots where user_id='00000000-0000-0000-0000-000000000001' and source_seed_id in ('gacha_common','gacha_rare','gacha_special')`);
   }
   try { await db.exec('begin;\n'+await readFile(file,'utf8')+'\ncommit;'); } catch(error) { throw new Error(file+': '+error.message, {cause:error}); }
   if (file.includes('scoped_game_reads')) {
    await db.exec('analyze public.garden_plots');
    const afterPlan=await db.query(`explain (format json) select distinct seed_id from public.garden_plots where user_id='00000000-0000-0000-0000-000000000001' and source_seed_id in ('gacha_common','gacha_rare','gacha_special')`);
    if (!JSON.stringify(afterPlan.rows).includes('garden_plots_discovery_idx')) throw Error('discovery index not selected: '+JSON.stringify(afterPlan.rows));
    t.diagnostic('Discovery query: before=' + JSON.stringify(beforePlan.rows).match(/\"Node Type\":\"[^\"]+\"/g)?.join(',') + '; after uses garden_plots_discovery_idx (forced index comparison, 5100 synthetic rows)');
    await db.exec(`reset enable_seqscan; delete from auth.users where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')`);
   }
  }
  const { plants } = await import('../lib/game.ts');
  const durations = await db.query("select id, grow_seconds from public.garden_catalog where kind='seed' and not retired");
  for (const plant of plants) {
   const row = durations.rows.find(row => row.id === plant.id);
   if (!row || row.grow_seconds !== plant.minutes * 60) throw Error('Growth duration mismatch: ' + plant.id);
  }
  for (const file of ['tests/economy.sql','tests/admin-cheats.sql','tests/gacha.sql','tests/tropical-crops.sql','tests/grass-planting.sql','tests/scoped-reads.sql','tests/watering.sql']) {
   try { await db.exec(await readFile(file,'utf8')); } catch(error) { throw new Error(file+': '+error.message,{cause:error}); }
  }
  await db.exec(await readFile('supabase/migrations/20261114124706_harvest_yield.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261114125602_realistic_crop_yields.sql','utf8'));
  const configuredYields = await db.query("select count(*)::int as total from public.garden_catalog where kind='seed' and not retired and yield_min >= 1 and yield_max >= yield_min");
  if (configuredYields.rows[0].total !== 21) throw Error('Missing crop yields');
  const yieldConfig = await db.query("select yield_min,yield_max from public.garden_catalog where id='carrot'");
  if (yieldConfig.rows[0].yield_min !== 2 || yieldConfig.rows[0].yield_max !== 5) throw Error('Incorrect carrot yield');
 } finally { await db.close(); }
});
