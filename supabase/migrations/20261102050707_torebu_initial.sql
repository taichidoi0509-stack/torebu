create schema if not exists torebu_private;
revoke all on schema torebu_private from public, anon;
grant usage on schema torebu_private to authenticated;

create table public.torebu_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 30)
);
create table public.torebu_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 1 and 40),
 invite_code uuid not null unique default gen_random_uuid(),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index torebu_groups_creator on public.torebu_groups(created_by);
create table public.torebu_members (
 group_id uuid not null references public.torebu_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create index torebu_members_user on public.torebu_members(user_id,group_id);

create function torebu_private.is_member(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.torebu_members where group_id=target and user_id=(select auth.uid()));
$$;
revoke all on function torebu_private.is_member(uuid) from public, anon;
grant execute on function torebu_private.is_member(uuid) to authenticated;

create function torebu_private.valid_items(items jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; s jsonb;
begin
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 30 then return false; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'name') is distinct from 'string' or char_length(btrim(item->>'name')) not between 1 and 60 or jsonb_typeof(item->'sets') is distinct from 'array' then return false; end if;
  if jsonb_array_length(item->'sets') not between 1 and 50 then return false;end if;
  for s in select value from jsonb_array_elements(item->'sets') loop
   if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'weight') is distinct from 'number' or jsonb_typeof(s->'reps') is distinct from 'number' then return false;end if;
   if (s->>'weight')::numeric not between 0 and 1000 or (s->>'reps')::numeric not between 1 and 999 or (s->>'reps')::numeric<>trunc((s->>'reps')::numeric) then return false;end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end;$$;
revoke all on function torebu_private.valid_items(jsonb) from public, anon;
grant execute on function torebu_private.valid_items(jsonb) to authenticated;

create table public.torebu_workouts (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.torebu_groups(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(char_length(btrim(name)) between 1 and 30),
 day date not null,
 note text not null default '' check(char_length(note)<=500),
 items jsonb not null check(torebu_private.valid_items(items)),
 created_at timestamptz not null default now()
);
create index torebu_workouts_group_time on public.torebu_workouts(group_id,created_at desc);
create index torebu_workouts_user on public.torebu_workouts(user_id);
create table public.torebu_likes (
 workout_id uuid not null references public.torebu_workouts(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 primary key(workout_id,user_id)
);
create index torebu_likes_user on public.torebu_likes(user_id);
create table public.torebu_comments (
 id uuid primary key default gen_random_uuid(),
 workout_id uuid not null references public.torebu_workouts(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(char_length(btrim(name)) between 1 and 30),
 body text not null check(char_length(btrim(body)) between 1 and 200),
 created_at timestamptz not null default now()
);
create index torebu_comments_workout on public.torebu_comments(workout_id,created_at);
create index torebu_comments_user on public.torebu_comments(user_id);
create function torebu_private.can_read_workout(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.torebu_workouts w where w.id=target and torebu_private.is_member(w.group_id));
$$;
revoke all on function torebu_private.can_read_workout(uuid) from public,anon;
grant execute on function torebu_private.can_read_workout(uuid) to authenticated;

alter table public.torebu_profiles enable row level security;
alter table public.torebu_groups enable row level security;
alter table public.torebu_members enable row level security;
alter table public.torebu_workouts enable row level security;
alter table public.torebu_likes enable row level security;
alter table public.torebu_comments enable row level security;
revoke all on public.torebu_profiles,public.torebu_groups,public.torebu_members,public.torebu_workouts,public.torebu_likes,public.torebu_comments from anon;
grant select,insert,update on public.torebu_profiles to authenticated;
grant select on public.torebu_groups,public.torebu_members to authenticated;
grant select,insert,delete on public.torebu_workouts,public.torebu_likes,public.torebu_comments to authenticated;

create policy torebu_profile_read on public.torebu_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy torebu_profile_insert on public.torebu_profiles for insert to authenticated with check(user_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy torebu_profile_update on public.torebu_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy torebu_group_read on public.torebu_groups for select to authenticated using(torebu_private.is_member(id));
create policy torebu_member_read on public.torebu_members for select to authenticated using(torebu_private.is_member(group_id));
create policy torebu_workout_read on public.torebu_workouts for select to authenticated using(torebu_private.is_member(group_id));
create policy torebu_workout_insert on public.torebu_workouts for insert to authenticated with check(user_id=(select auth.uid()) and torebu_private.is_member(group_id));
create policy torebu_workout_delete on public.torebu_workouts for delete to authenticated using(user_id=(select auth.uid()) and torebu_private.is_member(group_id));
create policy torebu_like_read on public.torebu_likes for select to authenticated using(torebu_private.can_read_workout(workout_id));
create policy torebu_like_insert on public.torebu_likes for insert to authenticated with check(user_id=(select auth.uid()) and torebu_private.can_read_workout(workout_id));
create policy torebu_like_delete on public.torebu_likes for delete to authenticated using(user_id=(select auth.uid()) and torebu_private.can_read_workout(workout_id));
create policy torebu_comment_read on public.torebu_comments for select to authenticated using(torebu_private.can_read_workout(workout_id));
create policy torebu_comment_insert on public.torebu_comments for insert to authenticated with check(user_id=(select auth.uid()) and torebu_private.can_read_workout(workout_id));
create policy torebu_comment_delete on public.torebu_comments for delete to authenticated using(user_id=(select auth.uid()) and torebu_private.can_read_workout(workout_id));

create function torebu_private.create_group(group_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); gid uuid;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'ログインしてください' using errcode='42501';end if;
 if char_length(btrim(coalesce(group_name,''))) not between 1 and 40 then raise exception 'グループ名を1〜40文字で入力してください';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from public.torebu_members where user_id=uid)>=30 then raise exception '参加できるグループは30個までです';end if;
 insert into public.torebu_groups(name,created_by) values(btrim(group_name),uid) returning id into gid;
 insert into public.torebu_members(group_id,user_id) values(gid,uid);
 return gid;
end;$$;
create function torebu_private.join_group(code uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();gid uuid;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'ログインしてください' using errcode='42501';end if;
 select id into gid from public.torebu_groups where invite_code=code;
 if gid is null then raise exception 'グループが見つかりません。招待リンクを確認してください';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from public.torebu_members where user_id=uid)>=30 and not torebu_private.is_member(gid) then raise exception '参加できるグループは30個までです';end if;
 insert into public.torebu_members(group_id,user_id) values(gid,uid) on conflict do nothing;
 return gid;
end;$$;
revoke all on function torebu_private.create_group(text),torebu_private.join_group(uuid) from public,anon;
grant execute on function torebu_private.create_group(text),torebu_private.join_group(uuid) to authenticated;
create function public.torebu_create_group(group_name text) returns uuid
language sql security invoker set search_path='' as $$ select torebu_private.create_group(group_name); $$;
create function public.torebu_join_group(code uuid) returns uuid
language sql security invoker set search_path='' as $$ select torebu_private.join_group(code); $$;
revoke all on function public.torebu_create_group(text),public.torebu_join_group(uuid) from public,anon;
grant execute on function public.torebu_create_group(text),public.torebu_join_group(uuid) to authenticated;

alter publication supabase_realtime add table public.torebu_workouts,public.torebu_likes,public.torebu_comments;
notify pgrst, 'reload schema';
