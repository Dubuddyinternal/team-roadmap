-- =====================================================================
-- STAGE 18g — HR permissions in Roles & permissions
--
-- Splits HR access into four permissions a role can have:
--   view_hr          HR: see employee files (read only)
--   manage_hr        HR: manage employee files (approve, send back, offer
--                    letters, change requests) — includes seeing them
--   manage_policies  HR: add and edit company policies
--   hr_settings      HR: company details and the offer letter template
-- Owners and super-admins have all of them. Run after stage18e.
-- Safe to run again.
-- =====================================================================

create or replace function public.all_perms() returns text[]
language sql immutable set search_path = '' as $$
  select array['view','comment','edit','delete','spaces','okr_structure','module_vision',
               'request_members','approve_requests','manage_people','create_games','edit_targets','edit_utm',
               'send_notifications','manage_learning','add_spaces','delete_spaces','add_roadmaps','delete_roadmaps',
               'review_student_ideas','manage_hr','view_hr','manage_policies','hr_settings']
$$;
update public.team_roles set perms = public.all_perms() where key = 'owner';

-- does the signed-in person have this permission in any of their teams?
create or replace function public.hr_perm_any(p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (public.is_super() or exists (
    select 1 from public.memberships m where m.user_id = auth.uid() and public.has_perm(m.team_slug, p_perm)))
$$;
-- may the signed-in person see this person's HR file? (manage_hr includes seeing)
create or replace function public.hr_can_view(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (public.is_super() or exists (
    select 1 from public.memberships m
     where m.user_id = p_user and (public.has_perm(m.team_slug, 'manage_hr') or public.has_perm(m.team_slug, 'view_hr'))))
$$;
revoke execute on function public.hr_perm_any(text), public.hr_can_view(uuid) from public, anon;
grant execute on function public.hr_perm_any(text), public.hr_can_view(uuid) to authenticated;

-- reading: own file, or HR who can see it
alter policy "read own or as hr" on public.hr_records using (user_id = auth.uid() or public.hr_can_view(user_id));
alter policy "read own docs or as hr" on public.hr_documents using (user_id = auth.uid() or public.hr_can_view(user_id));
alter policy "read own signatures or as hr" on public.hr_policy_signs using (user_id = auth.uid() or public.hr_can_view(user_id));
alter policy "read own or as hr" on public.hr_change_requests using (user_id = auth.uid() or public.hr_can_view(user_id));
alter policy "hr-docs read own or as hr" on storage.objects using (
  bucket_id = 'hr-docs' and ((storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.hr_can_view(((storage.foldername(name))[1])::uuid))));

-- company details + template: HR who send offer letters, and whoever edits them
alter policy "hr reads settings" on public.hr_settings using (public.hr_perm_any('manage_hr') or public.hr_perm_any('hr_settings'));
create or replace function public.hr_save_settings(p_company jsonb, p_template text)
returns public.hr_settings language plpgsql security definer set search_path = '' as $$
declare s public.hr_settings;
begin
  if not public.hr_perm_any('hr_settings') then raise exception 'You need the “HR: company details and offer letter” permission.'; end if;
  update public.hr_settings set company = coalesce(p_company, company), contract_template = coalesce(p_template, contract_template),
         updated_at = now(), updated_by = auth.uid() where id = 1 returning * into s;
  return s;
end $$;

-- policies: hidden ones and editing need manage_policies
alter policy "teammates read policies" on public.hr_policies
  using ((active and exists (select 1 from public.memberships m where m.user_id = auth.uid())) or public.hr_perm_any('manage_policies'));
create or replace function public.hr_save_policy(p_id uuid, p_slug text, p_title text, p_code text, p_body text,
                                                 p_needs_sign boolean, p_position int, p_active boolean, p_new_version boolean default false)
returns public.hr_policies language plpgsql security definer set search_path = '' as $$
declare p public.hr_policies;
begin
  if not public.hr_perm_any('manage_policies') then raise exception 'You need the “HR: edit company policies” permission.'; end if;
  if p_id is null then
    insert into public.hr_policies (slug, title, code, body, needs_sign, position, active)
    values (p_slug, p_title, coalesce(p_code, ''), coalesce(p_body, ''), coalesce(p_needs_sign, true), coalesce(p_position, 100), coalesce(p_active, true))
    returning * into p;
  else
    update public.hr_policies
       set title = p_title, code = coalesce(p_code, ''), body = coalesce(p_body, ''), needs_sign = coalesce(p_needs_sign, needs_sign),
           position = coalesce(p_position, position), active = coalesce(p_active, active),
           version = version + case when p_new_version then 1 else 0 end, updated_at = now(), updated_by = auth.uid()
     where id = p_id returning * into p;
    if p.id is null then raise exception 'That policy doesn''t exist.'; end if;
  end if;
  return p;
end $$;
