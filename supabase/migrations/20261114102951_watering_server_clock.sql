create or replace function garden_private.watering_public_question(s garden_private.watering_sessions) returns jsonb
language sql volatile set search_path='' as $$
 select (s.question_data - 'answer' - 'bank_id') || jsonb_build_object(
  'id',s.question_id,'expires_at',s.expires_at,'server_now',clock_timestamp()
 )
$$;
