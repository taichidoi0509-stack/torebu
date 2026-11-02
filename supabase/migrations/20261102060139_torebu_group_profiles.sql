create function torebu_private.can_read_profile(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and (target=(select auth.uid()) or exists(
  select 1 from public.torebu_members mine join public.torebu_members theirs on theirs.group_id=mine.group_id
  where mine.user_id=(select auth.uid()) and theirs.user_id=target
 ));
$$;
revoke all on function torebu_private.can_read_profile(uuid) from public,anon;
grant execute on function torebu_private.can_read_profile(uuid) to authenticated;
drop policy torebu_profile_read on public.torebu_profiles;
create policy torebu_profile_read on public.torebu_profiles for select to authenticated using(torebu_private.can_read_profile(user_id));
notify pgrst,'reload schema';
