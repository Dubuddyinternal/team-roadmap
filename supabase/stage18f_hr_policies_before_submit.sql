-- =====================================================================
-- STAGE 18f — sign the company policies before submitting the HR file
--
-- Same as stage18a's hr_save, plus: every active policy that needs a
-- signature must be signed (current version) before p_submit goes
-- through. Run after stage18b. Safe to run again.
-- =====================================================================

create or replace function public.hr_save(p_details jsonb, p_submit boolean default false, p_consent boolean default false)
returns public.hr_records language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.hr_records; missing text;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object' then raise exception 'Bad details.'; end if;
  insert into public.hr_records (user_id) values (me) on conflict (user_id) do nothing;
  select * into r from public.hr_records where user_id = me for update;
  if r.status not in ('draft', 'changes') then
    raise exception 'Your HR file is with HR now. Press ✏️ next to a detail to ask HR to change it.';
  end if;
  update public.hr_records set details = coalesce(p_details, '{}'::jsonb), updated_at = now() where user_id = me;

  if p_submit then
    if not p_consent then raise exception 'Please tick the consent box first.'; end if;
    select string_agg(k, ', ') into missing
      from unnest(array['full_name','dob','gender','father_name','mother_name','mobile','personal_email',
                        'cur_line','cur_city','cur_state','cur_pin','em1_name','em1_relation','em1_phone',
                        'aadhaar','pan','bank_holder','bank_name','bank_account','bank_ifsc']) k
     where coalesce(trim(p_details->>k), '') = '';
    if missing is not null then raise exception 'Some required details are empty: %', missing; end if;
    select string_agg(k, ', ') into missing
      from unnest(array['photo','aadhaar','pan','bank']) k
     where not exists (select 1 from public.hr_documents d where d.user_id = me and d.kind = k and d.status <> 'rejected');
    if missing is not null then raise exception 'Please upload: %', missing; end if;
    select string_agg(p.title, ', ' order by p.position) into missing
      from public.hr_policies p
     where p.active and p.needs_sign
       and not exists (select 1 from public.hr_policy_signs s where s.user_id = me and s.policy_id = p.id and s.version >= p.version);
    if missing is not null then raise exception 'Please sign the company policies first: %', missing; end if;
    update public.hr_records
       set status = 'submitted', submitted_at = now(), consent_at = coalesce(consent_at, now()), hr_note = null
     where user_id = me;
    perform public.hr_bell(public.hr_admins_for(me), '🗂️ ' || public.hr_name(me) || ' submitted their HR file',
      'Check it in Administration → Employees (HR).', public.hr_team_of(me));
  end if;
  select * into r from public.hr_records where user_id = me;
  return r;
end $$;
