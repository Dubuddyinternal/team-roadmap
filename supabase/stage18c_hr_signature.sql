-- =====================================================================
-- STAGE 18c — sign policies with a saved signature
--
-- A teammate uploads a photo of their signature once (hr_documents, kind
-- 'signature'). Signing a policy then stamps it with their name, the date,
-- the place and that signature. Run after stage18b. Safe to run again.
-- =====================================================================

-- signatures are documents of kind 'signature'
alter table public.hr_documents drop constraint if exists hr_documents_kind_check;
alter table public.hr_documents add constraint hr_documents_kind_check
  check (kind in ('photo', 'aadhaar', 'pan', 'address', 'bank', 'education', 'experience', 'contract', 'policy', 'signature', 'other'));

-- …and can be added any time, like signed policy copies
alter policy "add own policy copies" on public.hr_documents
  with check (user_id = auth.uid() and kind in ('policy', 'signature') and status = 'uploaded' and reviewed_by is null
              and path like auth.uid()::text || '/%');

-- where it was signed, and with which signature
alter table public.hr_policy_signs add column if not exists place text check (place is null or length(place) <= 120);
alter table public.hr_policy_signs add column if not exists sig_doc uuid references public.hr_documents(id) on delete set null;
alter table public.hr_policy_signs drop constraint if exists hr_policy_signs_method_check;
alter table public.hr_policy_signs add constraint hr_policy_signs_method_check
  check (method in ('typed', 'upload', 'signature'));

-- sign the current version with a saved signature (p_sig) or a signed copy (p_doc)
create or replace function public.hr_policy_sign(p_policy uuid, p_name text, p_place text, p_sig uuid default null, p_doc uuid default null)
returns public.hr_policy_signs language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); p public.hr_policies; s public.hr_policy_signs;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  select * into p from public.hr_policies where id = p_policy and active;
  if p.id is null then raise exception 'That policy isn''t available.'; end if;
  if not p.needs_sign then raise exception 'This policy doesn''t need a signature.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Add your full name in About you first.'; end if;
  if p_sig is null and p_doc is null then raise exception 'Upload your signature first.'; end if;
  if p_sig is not null and not exists (select 1 from public.hr_documents d where d.id = p_sig and d.user_id = me and d.kind = 'signature') then
    raise exception 'Upload your signature first.';
  end if;
  if p_doc is not null and not exists (select 1 from public.hr_documents d where d.id = p_doc and d.user_id = me and d.kind = 'policy') then
    raise exception 'Upload the signed copy first.';
  end if;
  -- a signature used on a policy is kept: it can't be deleted any more
  if p_sig is not null then
    update public.hr_documents set status = 'approved', reviewed_at = now() where id = p_sig and status = 'uploaded';
  end if;
  insert into public.hr_policy_signs (user_id, policy_id, version, signed_name, method, doc_id, place, sig_doc)
  values (me, p.id, p.version, left(trim(p_name), 140), case when p_doc is null then 'signature' else 'upload' end,
          p_doc, nullif(left(trim(coalesce(p_place, '')), 120), ''), p_sig)
  on conflict (user_id, policy_id, version) do update
    set signed_name = excluded.signed_name,
        method = case when excluded.doc_id is not null then 'upload' else 'signature' end,
        doc_id = coalesce(excluded.doc_id, public.hr_policy_signs.doc_id),
        place = coalesce(excluded.place, public.hr_policy_signs.place),
        sig_doc = coalesce(excluded.sig_doc, public.hr_policy_signs.sig_doc),
        signed_at = now()
  returning * into s;
  return s;
end $$;

revoke execute on function public.hr_policy_sign(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.hr_policy_sign(uuid, text, text, uuid, uuid) to authenticated;
