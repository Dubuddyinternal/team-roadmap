-- =====================================================================
-- STAGE 18d — sign the offer letter with the saved signature
--
-- Besides printing and uploading a signed copy, a teammate can now sign
-- the offer letter in one click with the signature saved in stage18c.
-- Also renames "contract" to "offer letter" in the bells. Run after
-- stage18c. Safe to run again.
-- =====================================================================

alter table public.hr_records add column if not exists offer_sig_doc uuid references public.hr_documents(id) on delete set null;
alter table public.hr_records add column if not exists offer_place text check (offer_place is null or length(offer_place) <= 120);
alter table public.hr_records add column if not exists offer_signed_name text check (offer_signed_name is null or length(offer_signed_name) <= 140);

-- sign the offer letter that's waiting, with the saved signature
create or replace function public.hr_sign_offer(p_sig uuid, p_place text)
returns public.hr_records language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.hr_records; nm text;
begin
  select * into r from public.hr_records where user_id = me for update;
  if r.user_id is null or r.status <> 'contract_sent' then raise exception 'There is no offer letter waiting for you.'; end if;
  if p_sig is null or not exists (select 1 from public.hr_documents d where d.id = p_sig and d.user_id = me and d.kind = 'signature') then
    raise exception 'Upload your signature first.';
  end if;
  if length(trim(coalesce(p_place, ''))) < 2 then raise exception 'Add the place (your city).'; end if;
  nm := coalesce(nullif(trim(r.details->>'full_name'), ''), public.hr_name(me));
  update public.hr_documents set status = 'approved', reviewed_at = now() where id = p_sig and status = 'uploaded';
  update public.hr_records set status = 'signed', signed_at = now(), updated_at = now(),
         offer_sig_doc = p_sig, offer_place = left(trim(p_place), 120), offer_signed_name = left(nm, 140)
   where user_id = me returning * into r;
  perform public.hr_bell(public.hr_admins_for(me), '✍️ ' || public.hr_name(me) || ' signed their offer letter',
    'Check it and mark the file complete in Administration → Employees (HR).', public.hr_team_of(me));
  return r;
end $$;

-- uploading a signed copy: same as before, new wording
create or replace function public.hr_mark_signed() returns public.hr_records
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.hr_records;
begin
  select * into r from public.hr_records where user_id = me for update;
  if r.user_id is null or r.status not in ('contract_sent', 'signed') then raise exception 'There is no offer letter waiting for you.'; end if;
  if not exists (select 1 from public.hr_documents d where d.user_id = me and d.kind = 'contract' and d.status <> 'rejected') then
    raise exception 'Upload the signed offer letter first.';
  end if;
  update public.hr_records set status = 'signed', signed_at = now(), updated_at = now() where user_id = me returning * into r;
  perform public.hr_bell(public.hr_admins_for(me), '✍️ ' || public.hr_name(me) || ' uploaded their signed offer letter',
    'Check it and mark the file complete in Administration → Employees (HR).', public.hr_team_of(me));
  return r;
end $$;

-- HR actions: same as stage18a; sending a new offer letter clears the old signature
create or replace function public.hr_admin_update(p_user uuid, p_action text, p_job jsonb default null,
                                                  p_note text default null, p_contract_html text default null)
returns public.hr_records language plpgsql security definer set search_path = '' as $$
declare r public.hr_records;
begin
  if not public.hr_can_admin(p_user) then raise exception 'Only HR can do this.'; end if;
  insert into public.hr_records (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into r from public.hr_records where user_id = p_user for update;

  if p_action = 'save_job' then
    if jsonb_typeof(coalesce(p_job, '{}'::jsonb)) <> 'object' then raise exception 'Bad job details.'; end if;
    update public.hr_records set job = coalesce(p_job, '{}'::jsonb), updated_at = now() where user_id = p_user returning * into r;
  elsif p_action = 'send_back' then
    if coalesce(trim(p_note), '') = '' then raise exception 'Write what needs to change.'; end if;
    update public.hr_records set status = 'changes', hr_note = left(p_note, 2000), updated_at = now() where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '🗂️ HR asked for changes to your HR file', left(p_note, 600) || E'\n\nOpen your account menu → My HR file.');
  elsif p_action = 'contract_sent' then
    if coalesce(p_contract_html, '') = '' then raise exception 'The offer letter is empty.'; end if;
    update public.hr_records set status = 'contract_sent', contract_html = p_contract_html, contract_sent_at = now(),
           signed_at = null, offer_sig_doc = null, offer_place = null, offer_signed_name = null, updated_at = now()
     where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '✍️ Your offer letter is in your email',
      'Read it and sign it in your account menu → My HR file → Offer letter.');
  elsif p_action = 'complete' then
    update public.hr_records set status = 'complete', completed_at = now(), completed_by = auth.uid(), hr_note = null, updated_at = now()
     where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '✅ Your HR file is complete', 'Thanks! Nothing more is needed from you.');
  elsif p_action = 'reopen' then
    update public.hr_records set status = 'changes', hr_note = coalesce(nullif(left(p_note, 2000), ''), r.hr_note), completed_at = null, updated_at = now()
     where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '🗂️ HR reopened your HR file', coalesce(nullif(left(p_note, 600), ''), 'Please check your details.'));
  else
    raise exception 'Unknown action.';
  end if;
  return r;
end $$;

revoke execute on function public.hr_sign_offer(uuid, text) from public, anon;
grant execute on function public.hr_sign_offer(uuid, text) to authenticated;
