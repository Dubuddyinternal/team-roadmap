-- =====================================================================
-- STAGE 18h — company equipment and who is responsible for it
--
-- HR lists the equipment (cameras, mics, laptops…). It's handed over
-- person to person: the holder (or HR) offers it, the next person
-- accepts it by signing the equipment agreement with their saved
-- signature, and from then on they are responsible for it. Every
-- accepted hand-over keeps its signed agreement.
-- Run after stage18g. Safe to run again.
-- =====================================================================

-- the agreement wording (HR → Equipment → Agreement wording)
alter table public.hr_settings add column if not exists equipment_template text not null default ''
  check (length(equipment_template) <= 30000);
update public.hr_settings set equipment_template = $t$# Equipment Handover and Responsibility Agreement

I, {full_name}, confirm that on {date} I received the following equipment belonging to {company} from {from_name}:

Equipment: {equipment}
Serial / ID: {serial}
Condition and notes: {condition}

## I agree that

1. The equipment belongs to {company_short} and is given to me only for company work.
2. From today, I am solely responsible for it. If it is damaged, lost or stolen while in my care, I will pay for its repair or replacement, as decided by {company_short}. Normal wear and tear is not counted as damage.
3. I will keep it safe. I will not lend it to anyone outside {company_short}, and I will not change, sell or pledge it.
4. I will tell HR at once about any damage, loss or theft, and report a theft to the police.
5. I will pass it on only through the Equipment section of My HR file. It stays my responsibility until the next person accepts it there.
6. I will return it when {company_short} asks, or when I leave, in the same condition apart from normal wear and tear. {company_short} may recover the cost of any missing or damaged equipment from my final settlement.$t$
 where id = 1 and equipment_template = '';

create table if not exists public.hr_equipment (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),
  category   text not null default '' check (length(category) <= 60),
  serial     text not null default '' check (length(serial) <= 120),
  notes      text not null default '' check (length(notes) <= 1000),
  holder     uuid references public.profiles(id) on delete set null,   -- null = with HR
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hr_equipment_moves (
  id           uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.hr_equipment(id) on delete cascade,
  from_user    uuid references public.profiles(id) on delete set null,  -- null = from HR
  to_user      uuid references public.profiles(id) on delete set null,  -- null = back to HR
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  note         text check (note is null or length(note) <= 1000),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  -- what was signed (filled in when accepted)
  signed_name  text check (signed_name is null or length(signed_name) <= 140),
  from_name    text check (from_name is null or length(from_name) <= 140),
  place        text check (place is null or length(place) <= 120),
  sig_doc      uuid references public.hr_documents(id) on delete set null,
  item_name    text, item_serial text, item_condition text,
  template     text check (template is null or length(template) <= 30000)
);
create index if not exists hr_equipment_moves_item on public.hr_equipment_moves (equipment_id, created_at desc);
create unique index if not exists hr_equipment_moves_open on public.hr_equipment_moves (equipment_id) where status = 'pending';

alter table public.hr_equipment enable row level security;
alter table public.hr_equipment_moves enable row level security;
drop policy if exists "teammates read equipment" on public.hr_equipment;
create policy "teammates read equipment" on public.hr_equipment for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = auth.uid()) or public.is_super());
drop policy if exists "read own moves or as hr" on public.hr_equipment_moves;
create policy "read own moves or as hr" on public.hr_equipment_moves for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or public.hr_perm_any('manage_hr') or public.hr_perm_any('view_hr'));
revoke all on public.hr_equipment, public.hr_equipment_moves from anon;
grant select on public.hr_equipment, public.hr_equipment_moves to authenticated;

-- ---------- functions ----------
-- HR adds or edits an item
create or replace function public.hr_equipment_save(p_id uuid, p_name text, p_category text, p_serial text, p_notes text, p_active boolean default true)
returns public.hr_equipment language plpgsql security definer set search_path = '' as $$
declare e public.hr_equipment;
begin
  if not public.hr_perm_any('manage_hr') then raise exception 'Only HR can change the equipment list.'; end if;
  if length(trim(coalesce(p_name, ''))) < 1 then raise exception 'Give it a name.'; end if;
  if p_id is null then
    insert into public.hr_equipment (name, category, serial, notes, active)
    values (trim(p_name), trim(coalesce(p_category, '')), trim(coalesce(p_serial, '')), trim(coalesce(p_notes, '')), coalesce(p_active, true))
    returning * into e;
  else
    update public.hr_equipment set name = trim(p_name), category = trim(coalesce(p_category, '')), serial = trim(coalesce(p_serial, '')),
           notes = trim(coalesce(p_notes, '')), active = coalesce(p_active, active), updated_at = now()
     where id = p_id returning * into e;
    if e.id is null then raise exception 'That item doesn''t exist.'; end if;
  end if;
  return e;
end $$;

-- the holder (or HR, for an item that's with HR) offers it to someone
create or replace function public.hr_equipment_offer(p_equipment uuid, p_to uuid, p_note text default null)
returns public.hr_equipment_moves language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); e public.hr_equipment; mv public.hr_equipment_moves;
begin
  select * into e from public.hr_equipment where id = p_equipment for update;
  if e.id is null or not e.active then raise exception 'That item isn''t available.'; end if;
  if not (e.holder = me or (e.holder is null and public.hr_perm_any('manage_hr'))) then
    raise exception 'Only the person holding it can pass it on.';
  end if;
  if p_to is null or p_to = me or p_to = e.holder then raise exception 'Pick who gets it.'; end if;
  if not exists (select 1 from public.memberships m where m.user_id = p_to) then raise exception 'That person isn''t in the team.'; end if;
  if exists (select 1 from public.hr_equipment_moves x where x.equipment_id = e.id and x.status = 'pending') then
    raise exception 'It is already waiting for someone to accept it.';
  end if;
  insert into public.hr_equipment_moves (equipment_id, from_user, to_user, note, created_by)
  values (e.id, e.holder, p_to, nullif(left(trim(coalesce(p_note, '')), 1000), ''), me) returning * into mv;
  perform public.hr_bell(array[p_to], '🎒 ' || coalesce(public.hr_name(e.holder), 'HR') || ' is handing you: ' || e.name,
    'Accept it in your profile menu → My HR file → Equipment. Once you sign, you are responsible for it.');
  return mv;
end $$;

-- the sender or HR takes an offer back before it's accepted
create or replace function public.hr_equipment_cancel(p_move uuid)
returns public.hr_equipment_moves language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); mv public.hr_equipment_moves;
begin
  select * into mv from public.hr_equipment_moves where id = p_move for update;
  if mv.id is null or mv.status <> 'pending' then raise exception 'There is nothing to cancel.'; end if;
  if not (mv.created_by = me or mv.from_user = me or public.hr_perm_any('manage_hr')) then raise exception 'You can''t cancel this.'; end if;
  update public.hr_equipment_moves set status = 'cancelled', decided_at = now() where id = p_move returning * into mv;
  return mv;
end $$;

-- the person it's offered to accepts (signing the agreement) or declines
create or replace function public.hr_equipment_answer(p_move uuid, p_accept boolean, p_place text default null, p_sig uuid default null)
returns public.hr_equipment_moves language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); mv public.hr_equipment_moves; e public.hr_equipment; nm text; tpl text;
begin
  select * into mv from public.hr_equipment_moves where id = p_move and to_user = me for update;
  if mv.id is null or mv.status <> 'pending' then raise exception 'There is nothing waiting for you here.'; end if;
  select * into e from public.hr_equipment where id = mv.equipment_id for update;
  if not p_accept then
    update public.hr_equipment_moves set status = 'declined', decided_at = now() where id = p_move returning * into mv;
    perform public.hr_bell(case when mv.from_user is null then public.hr_admins_for(me) else array[mv.from_user] end,
      '🎒 ' || public.hr_name(me) || ' didn''t accept: ' || e.name, 'It stays with ' || coalesce(public.hr_name(mv.from_user), 'HR') || '.');
    return mv;
  end if;
  if p_sig is null or not exists (select 1 from public.hr_documents d where d.id = p_sig and d.user_id = me and d.kind = 'signature') then
    raise exception 'Upload your signature first.';
  end if;
  if length(trim(coalesce(p_place, ''))) < 2 then raise exception 'Add the place (your city).'; end if;
  select coalesce(nullif(trim(r.details->>'full_name'), ''), public.hr_name(me)) into nm from public.hr_records r where r.user_id = me;
  nm := coalesce(nm, public.hr_name(me));
  select nullif(s.equipment_template, '') into tpl from public.hr_settings s where s.id = 1;
  update public.hr_documents set status = 'approved', reviewed_at = now() where id = p_sig and status = 'uploaded';
  update public.hr_equipment_moves
     set status = 'accepted', decided_at = now(), signed_name = left(nm, 140), place = left(trim(p_place), 120), sig_doc = p_sig,
         from_name = left(coalesce(public.hr_name(mv.from_user), 'HR'), 140),
         item_name = e.name, item_serial = e.serial, item_condition = e.notes, template = tpl
   where id = p_move returning * into mv;
  update public.hr_equipment set holder = me, updated_at = now() where id = e.id;
  perform public.hr_bell(case when mv.from_user is null then public.hr_admins_for(me) else array[mv.from_user] end,
    '🎒 ' || public.hr_name(me) || ' accepted: ' || e.name, 'They are responsible for it now.');
  return mv;
end $$;

-- HR takes an item back (returned, broken, someone left)
create or replace function public.hr_equipment_take_back(p_equipment uuid, p_note text default null)
returns public.hr_equipment language plpgsql security definer set search_path = '' as $$
declare e public.hr_equipment;
begin
  if not public.hr_perm_any('manage_hr') then raise exception 'Only HR can do this.'; end if;
  select * into e from public.hr_equipment where id = p_equipment for update;
  if e.id is null then raise exception 'That item doesn''t exist.'; end if;
  update public.hr_equipment_moves set status = 'cancelled', decided_at = now() where equipment_id = e.id and status = 'pending';
  if e.holder is not null then
    insert into public.hr_equipment_moves (equipment_id, from_user, to_user, status, note, created_by, decided_at, from_name, signed_name, item_name, item_serial, item_condition)
    values (e.id, e.holder, null, 'accepted', nullif(left(trim(coalesce(p_note, '')), 1000), ''), auth.uid(), now(),
            left(public.hr_name(e.holder), 140), left(public.hr_name(auth.uid()), 140), e.name, e.serial, e.notes);
    perform public.hr_bell(array[e.holder], '🎒 HR took back: ' || e.name, coalesce(nullif(trim(p_note), ''), 'You are no longer responsible for it.'));
  end if;
  update public.hr_equipment set holder = null, updated_at = now() where id = e.id returning * into e;
  return e;
end $$;

-- the agreement wording ("HR: company details & offer letter")
create or replace function public.hr_save_equipment_template(p_template text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.hr_perm_any('hr_settings') then raise exception 'You need the “HR: company details & offer letter” permission.'; end if;
  update public.hr_settings set equipment_template = coalesce(p_template, ''), updated_at = now(), updated_by = auth.uid() where id = 1;
  return p_template;
end $$;
-- everyone may read the wording they are about to sign
create or replace function public.hr_equipment_wording() returns text
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.memberships m where m.user_id = auth.uid()) or public.is_super()
              then (select s.equipment_template from public.hr_settings s where s.id = 1) end
$$;

revoke execute on function public.hr_equipment_save(uuid, text, text, text, text, boolean), public.hr_equipment_offer(uuid, uuid, text),
  public.hr_equipment_cancel(uuid), public.hr_equipment_answer(uuid, boolean, text, uuid), public.hr_equipment_take_back(uuid, text),
  public.hr_save_equipment_template(text), public.hr_equipment_wording() from public, anon;
grant execute on function public.hr_equipment_save(uuid, text, text, text, text, boolean), public.hr_equipment_offer(uuid, uuid, text),
  public.hr_equipment_cancel(uuid), public.hr_equipment_answer(uuid, boolean, text, uuid), public.hr_equipment_take_back(uuid, text),
  public.hr_save_equipment_template(text), public.hr_equipment_wording() to authenticated;
