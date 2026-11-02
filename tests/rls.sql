-- Run as the database administrator. All fixture writes are rolled back.
begin;
select set_config('torebu.test_a',(select id::text from auth.users order by created_at limit 1),true);
select set_config('torebu.test_b',(select id::text from auth.users order by created_at offset 1 limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('torebu.test_a'),'role','authenticated','is_anonymous',false)::text,true);
select set_config('torebu.test_group',public.torebu_create_group('トレ部の権限検証')::text,true);
select set_config('torebu.test_code',(select invite_code::text from public.torebu_groups where id=current_setting('torebu.test_group')::uuid),true);
select set_config('torebu.test_workout',gen_random_uuid()::text,true);
insert into public.torebu_workouts(id,group_id,user_id,name,day,items) values(current_setting('torebu.test_workout')::uuid,current_setting('torebu.test_group')::uuid,current_setting('torebu.test_a')::uuid,'テストA',current_date,'[{"name":"ベンチプレス","sets":[{"weight":60,"reps":10}]}]');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('torebu.test_b'),'role','authenticated','is_anonymous',false,'user_metadata',jsonb_build_object('admin',true))::text,true);
do $$declare n integer;begin
 if exists(select 1 from public.torebu_groups where id=current_setting('torebu.test_group')::uuid) then raise exception 'non-member read group';end if;
 if exists(select 1 from public.torebu_workouts where id=current_setting('torebu.test_workout')::uuid) then raise exception 'non-member read workout';end if;
 begin
  insert into public.torebu_workouts(group_id,name,day,items) values(current_setting('torebu.test_group')::uuid,'B',current_date,'[{"name":"test","sets":[{"weight":0,"reps":1}]}]');
  raise exception 'non-member inserted workout';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.torebu_members(group_id,user_id) values(current_setting('torebu.test_group')::uuid,auth.uid());
  raise exception 'membership inserted directly';
 exception when insufficient_privilege then null;end;
 delete from public.torebu_workouts where id=current_setting('torebu.test_workout')::uuid;
 get diagnostics n=row_count;if n<>0 then raise exception 'non-owner deleted';end if;
end$$;
select public.torebu_join_group(current_setting('torebu.test_code')::uuid);
select public.torebu_join_group(current_setting('torebu.test_code')::uuid);
do $$declare n integer;begin
 if (select count(*) from public.torebu_members where group_id=current_setting('torebu.test_group')::uuid)<>2 then raise exception 'membership not idempotent';end if;
 if not exists(select 1 from public.torebu_workouts where id=current_setting('torebu.test_workout')::uuid) then raise exception 'member cannot read';end if;
 delete from public.torebu_workouts where id=current_setting('torebu.test_workout')::uuid;
 get diagnostics n=row_count;if n<>0 then raise exception 'member deleted other user workout';end if;
 begin
  insert into public.torebu_workouts(group_id,name,day,items) values(current_setting('torebu.test_group')::uuid,'B',current_date,'[{}]');
  raise exception 'invalid items accepted';
 exception when check_violation then null;end;
 begin
  insert into public.torebu_workouts(group_id,user_id,name,day,items) values(current_setting('torebu.test_group')::uuid,current_setting('torebu.test_a')::uuid,'B',current_date,'[{"name":"test","sets":[{"weight":0,"reps":1}]}]');
  raise exception 'spoofed user accepted';
 exception when insufficient_privilege then null;end;
end$$;
insert into public.torebu_likes(workout_id) values(current_setting('torebu.test_workout')::uuid);
insert into public.torebu_comments(workout_id,name,body) values(current_setting('torebu.test_workout')::uuid,'テストB','ナイス');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('torebu.test_b'),'role','authenticated','is_anonymous',true)::text,true);
do $$begin
 if exists(select 1 from public.torebu_workouts where id=current_setting('torebu.test_workout')::uuid) then raise exception 'anonymous user read workout';end if;
 begin perform public.torebu_create_group('anonymous');raise exception 'anonymous created group';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.torebu_workouts;raise exception 'anon read';exception when insufficient_privilege then null;end;
 begin perform public.torebu_create_group('anon');raise exception 'anon rpc';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'PASS: group isolation, invitation membership, owner-only deletes, input validation, spoof prevention, anonymous denial; fixtures rolled back' as result;
