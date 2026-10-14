-- =====================================================================
-- STAGE 18b — Company policies everyone reads and signs
--
-- 1. A library of company policies (hr_policies): Work Systems, Leave,
--    Ethics & Business Conduct, POSH, and the Acknowledgement, Acceptance &
--    Agreement. Each is a template: {company}, {company_short}, {full_name},
--    {date}, {policy_list}… are filled in when someone reads it.
--    HR (super-admins and "Manage HR files") edits them in Administration →
--    🗂️ Employees (HR) → 📜 Policies. Saving "as a new version" asks
--    everyone to sign it again.
-- 2. Everyone reads them in 🗂️ My HR file → 📜 Policies (or Administration →
--    📜 Company policies) and signs each one: either by typing their name
--    and agreeing, or by uploading a signed copy (kept in hr-docs, kind
--    'policy'). Signatures live in hr_policy_signs, per policy version.
-- 3. The company name and details are readable by every teammate through
--    hr_company(), so the policies can show them.
--
-- Needs stage18a. RUN: paste this whole file into Supabase → SQL editor →
-- Run. SAFETY: only adds things (and lets hr_documents hold 'policy' files).
-- =====================================================================

-- ---------- 1. tables ----------
create table if not exists public.hr_policies (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  title       text not null check (length(trim(title)) between 1 and 140),
  code        text not null default '' check (length(code) <= 60),
  body        text not null default '' check (length(body) <= 120000),
  version     int  not null default 1 check (version >= 1),
  needs_sign  boolean not null default true,
  position    int  not null default 100,
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.hr_policies enable row level security;

create table if not exists public.hr_policy_signs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  policy_id   uuid not null references public.hr_policies(id) on delete cascade,
  version     int  not null,
  signed_name text not null check (length(trim(signed_name)) between 2 and 140),
  method      text not null check (method in ('typed', 'upload')),
  doc_id      uuid references public.hr_documents(id) on delete set null,
  signed_at   timestamptz not null default now(),
  unique (user_id, policy_id, version)
);
create index if not exists hr_policy_signs_user on public.hr_policy_signs (user_id);
alter table public.hr_policy_signs enable row level security;

-- anyone in a team reads the active policies; HR also sees inactive drafts
drop policy if exists "teammates read policies" on public.hr_policies;
create policy "teammates read policies" on public.hr_policies for select to authenticated
  using ((active and exists (select 1 from public.memberships m where m.user_id = auth.uid())) or public.hr_is_admin());
drop policy if exists "read own signatures or as hr" on public.hr_policy_signs;
create policy "read own signatures or as hr" on public.hr_policy_signs for select to authenticated
  using (user_id = auth.uid() or public.hr_can_admin(user_id));

-- signed copies are kept as documents of kind 'policy'
alter table public.hr_documents drop constraint if exists hr_documents_kind_check;
alter table public.hr_documents add constraint hr_documents_kind_check
  check (kind in ('photo', 'aadhaar', 'pan', 'address', 'bank', 'education', 'experience', 'contract', 'policy', 'other'));
-- …and can be uploaded even after the HR file is complete (policies change)
drop policy if exists "add own policy copies" on public.hr_documents;
create policy "add own policy copies" on public.hr_documents for insert to authenticated
  with check (user_id = auth.uid() and kind = 'policy' and status = 'uploaded' and reviewed_by is null
              and path like auth.uid()::text || '/%');

-- ---------- 2. functions ----------
-- the company details every teammate may see (for the policies' wording)
create or replace function public.hr_company() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.memberships m where m.user_id = auth.uid()) or public.is_super()
              then coalesce((select s.company from public.hr_settings s where s.id = 1), '{}'::jsonb)
              else '{}'::jsonb end
$$;

-- sign the current version of a policy: typed name, or a signed copy (p_doc)
create or replace function public.hr_sign_policy(p_policy uuid, p_name text, p_doc uuid default null)
returns public.hr_policy_signs language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); p public.hr_policies; s public.hr_policy_signs;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  select * into p from public.hr_policies where id = p_policy and active;
  if p.id is null then raise exception 'That policy isn''t available.'; end if;
  if not p.needs_sign then raise exception 'This policy doesn''t need a signature.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Type your full name to sign.'; end if;
  if p_doc is not null and not exists (select 1 from public.hr_documents d where d.id = p_doc and d.user_id = me and d.kind = 'policy') then
    raise exception 'Upload the signed copy first.';
  end if;
  insert into public.hr_policy_signs (user_id, policy_id, version, signed_name, method, doc_id)
  values (me, p.id, p.version, left(trim(p_name), 140), case when p_doc is null then 'typed' else 'upload' end, p_doc)
  on conflict (user_id, policy_id, version) do update
    set signed_name = excluded.signed_name,
        method = case when excluded.doc_id is not null then 'upload' else public.hr_policy_signs.method end,
        doc_id = coalesce(excluded.doc_id, public.hr_policy_signs.doc_id),
        signed_at = now()
  returning * into s;
  return s;
end $$;

-- HR adds or edits a policy; p_new_version asks everyone to sign again
create or replace function public.hr_save_policy(p_id uuid, p_slug text, p_title text, p_code text, p_body text,
                                                 p_needs_sign boolean, p_position int, p_active boolean, p_new_version boolean default false)
returns public.hr_policies language plpgsql security definer set search_path = '' as $$
declare p public.hr_policies;
begin
  if not public.hr_is_admin() then raise exception 'Only HR can change policies.'; end if;
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

revoke execute on function public.hr_company(), public.hr_sign_policy(uuid, text, uuid),
  public.hr_save_policy(uuid, text, text, text, text, boolean, int, boolean, boolean) from public, anon;
grant execute on function public.hr_company(), public.hr_sign_policy(uuid, text, uuid),
  public.hr_save_policy(uuid, text, text, text, text, boolean, int, boolean, boolean) to authenticated;
revoke all on public.hr_policies, public.hr_policy_signs from anon;
grant select on public.hr_policies, public.hr_policy_signs to authenticated;

update public.hr_settings set company = company || jsonb_build_object('short', 'Cyberflow')
 where id = 1 and not (company ? 'short');

-- ---------- 3. the starting policies (from our existing policy documents) ----------
-- Placeholders: {company} {company_short} {full_name} {date} {policy_list}.
-- # = title, ## = heading, a blank line starts a new paragraph.
insert into public.hr_policies (slug, title, code, position, needs_sign, body) values
('work-systems', 'Work Systems Policy', 'HR/WS/Ver1.0', 10, true, $p$# Work Systems Policy

## Objective

{company_short} recognizes the role of organizational discipline in growth and development. To facilitate organized functioning, to support the endeavour of creating a fair work environment and to communicate the threshold expectations to the employees, the general working conditions enumerated hereunder have been evolved.

## Scope

All employees and offices of {company_short}.

## 1. Working days / weekly off

a. The office locations work from Monday through Saturday.
b. Sundays are weekly off days. However, in order to meet business exigencies and pressing work demands, you may, in discussion with your reporting manager, work on non-working Sundays / holidays.

## 2. Working hours

{company_short} offices will remain open from 08.30 hours to 19.30 hours from Monday through Saturday. Core hours of work will be from 10.00 am to 06.30 pm. These are mandatory working hours. A 30-minute lunch break is provided between 01:00 pm and 02:00 pm.

All employees shall be required to clock in a minimum of 8 hours and 30 minutes on all working days, inclusive of all break times.

## 3. Compensatory off

a. In the unforeseen event of an employee working on a declared holiday / weekly off, he / she shall be entitled to a 'compensatory off' in lieu of the same. A compensatory off should be availed within 30 days of having worked on a declared holiday / weekly off.
b. This is, however, subject to approval from the Head of the Department. The same shall have to be intimated to payroll for updating of leave records.
c. Compensatory off may be availed only by employees in Grade C and below.

## 4. Identity cum access and attendance card

a. All employees shall be issued an identity cum access and attendance card. This must be displayed at all times in the premises and produced for inspection whenever required.
b. The card is non-transferable and is surrendered when you leave the services of the company. In case you lose the card, a duplicate may be obtained from Admin on payment of an amount prescribed from time to time. Loss of identity cards must be reported immediately to the Admin department.
c. An attendance register [electronic or manual] is available at the front office where every employee is required to log in / sign. In case of an outdoor official duty, the immediate superior should be intimated in advance. The ID card issued to employees will record time in and time out as well. All employees shall mandatorily swipe / use the card for entering and leaving the premises. The system is linked to payroll processing.

## 5. Attendance

a. The 'In-time' and 'Out-time' shall be captured by the attendance monitoring system by use of the access card / biometric system / retina reader.
b. All employees shall manually sign in the manual attendance register to record their attendance in the absence of an automated attendance monitoring system.
c. Attendance is calculated from the 26th of the previous month to the 25th of the current month.

## 6. Late coming / absence / leave / outdoor duty

a. If for any reason an employee is expected to be late or absent, the onus is on the employee to keep his / her immediate Reporting Manager or Functional Head informed.
b. Frequent late coming (more than ONE late coming in a month shall be considered as habitual) / poor attendance will impact individual performance and eventually one's career.
c. In the event that an employee is required to move out of office for official purposes, an Outdoor Duty Slip is required to be filled up and approved by his / her Reporting Manager. The onus is on the employee to mark "OD" in the relevant date columns of the manual register before proceeding on outdoor duty. In case the employee leaves for outdoor duty directly from his / her residence, the same should be done upon returning to the office.
d. In case the employee is availing leave, the employee shall avail leave as per his / her eligibility according to the Leave Policy of the Company.
e. In the absence of any leave balance, the same shall be considered as Leave without Pay.

## 7. National and festival holidays

10 days are declared at the beginning of each calendar year by the Company.

{company_short} HR will issue the consolidated list of holidays to be observed in a calendar year at the beginning of the new year.

Employees of {company_short} location offices shall follow the holiday list of the respective locations.

## 8. Dress code

Work attire may be formal or semi-formal. Attire at the workplace shall recognize and respect the sensibilities of the operating environment, both internal and external. Outfits that reflect 'casualness', or are likely to spell disrespect for the organization or are not befitting an official occasion involving a customer, stakeholder or business associate, shall be avoided at all times. Jeans and collar-less T-shirts do not qualify as 'formal' or 'semi-formal' attire at {company_short}. These are to be avoided from Monday through Friday. Choice of footwear shall be appropriate to the corporate office environment.

Smart business casuals are permitted on Fridays and while on holiday working.

## 9. Workplace hygiene, housekeeping and safety

It is the endeavour of the Company to provide all its employees with hardware and access to software that is relevant to their assignment / work.

{company_short} would like to maintain the highest standards of hygiene and cleanliness in its premises. This is not possible without the active involvement and cooperation of all employees. The following simple rules shall help achieve this objective:

a. To enable ready access to information and documentation, sort all papers and put them into files and folders. Unnecessary papers need to be shredded / disposed of on a daily basis. Print-outs or photocopies, wherever unnecessary, shall be avoided.
b. Coffee cups (disposable) may be disposed of in the pantry and not in workstation bins, since they stain the workplace, smell and, more importantly, run the risk of attracting rats.
c. Employees' cooperation is sought in the proper disposal of waste, garbage and trash, and in maintaining hygiene in the pantry and toilets.
d. All work papers may be put away in an organised manner at the end of the day to leave behind a clean desk. This is in the interest of security and cleanliness.
e. Any office property in the employee's custody shall be the responsibility of the employee. The same should be returned to the company in good condition after use.
f. All employees using a two-wheeler must mandatorily wear safety helmets while on official duty / otherwise.
g. Any act by an employee at the workplace or in relation to work that is likely to cause harm to himself / herself or endanger others in the environment will be deemed as misconduct, and appropriate action will be initiated against the concerned employee.

## 10. Smoking

{company_short} is a non-smoking office across the country. In case employees want to smoke, they may do so outside the premises of the office or in designated open places in the periphery of the office premises.$p$),

('leave', 'Leave Policy', 'HR/LP/Ver1.0', 20, true, $p$# Leave Policy and Guidelines

## 1. Purpose

This policy details the eligibility and procedure that govern requesting and granting of leave for employees to take a break from work to refresh and re-energize themselves or meet important personal commitments.

## 2. Philosophy

{company_short} places high value on working relationships amongst its employees. It is the organization's belief that the quality of the work relationship that an employee shares with his / her reportee and vice versa is a key driver of efficiency and joy at work. Keeping this in mind, the organization views the subject of leave sanction as one that is governed by superior-subordinate work ethics at all times. Leave is, however, not a matter of right and can be subjected to evaluation and scrutiny of reason and urgency by the sanctioning authority.

## 3. Scope and coverage

This policy is applicable to:
a) All confirmed employees on the rolls of {company_short}.
b) {company_short} employees in all offices.
c) All employees on probation, who are eligible for 3 APLs (All Purpose Leaves) during the probation period.

## 4. Definitions

Calendar year: The year for calculation of leave is the calendar year, i.e. January to December.

Approving authority: The approving authority for leave at all levels will be the Functional Head or the Reporting Manager, not below the level of a Manager.

## 5.1 Types of leave

a. Casual Leave – applicable to confirmed employees
b. Sick Leave – applicable to confirmed employees
c. Privilege Leave – credited after completion of ONE year of service
d. Maternity Leave – women employees who have completed 80 days of service
e. Paternity Leave – all confirmed male employees
f. All Purpose Leave – applicable to probationers
g. National and festival holidays

## a. Casual Leave

i. The purpose of Casual Leave is to provide leave to employees to meet certain unforeseen exigencies – for personal work or family affairs, for compassionate reasons, or to attend to any work that is not of an official nature.
ii. Casual Leave can be availed by employees from the date of their joining.
iii. All employees are entitled to 8 days of Casual Leave in a calendar year with full pay. Casual Leave will be credited to the leave account at the beginning of the year. For employees who join during the year, Casual Leave shall be computed on a pro-rata basis and credited to their leave account.

Guidelines
i. Except for unforeseen circumstances, prior sanction is required to avail Casual Leave.
ii. If it is not possible to take prior sanction, the employee is required to inform his / her Supervisor / Function Head through a message or by calling by 11.00 a.m. On resuming duties, the leave application shall be filled up and forwarded for approval and appropriate documentation.
iii. At any given point in time, Casual Leave shall be availed for a maximum of 3 days at a stretch.
iv. Casual Leave cannot be clubbed with any other leave.
v. Company-declared holidays / weekly offs can either be prefixed or suffixed with Casual Leave.
vi. However, Casual Leave cannot be sandwiched between two holidays / a weekly off and a holiday. If it is sandwiched between two company-declared holidays, or between a weekly off and a company-declared holiday, the longer sequence will be counted for the purpose of calculating leave.
vii. Casual Leave for a year will not be carried forward to the next year. At the end of each calendar year, unutilised Casual Leave will automatically lapse.
viii. On separation from the company for any reason whatsoever, if Casual Leave availed is more than the entitlement for the period served (calculated on a pro-rata basis), such excess leave shall be adjusted against Privilege Leave or recovered from the full and final settlement.

## b. Sick Leave

i. Sick Leave is provided to employees to use when they are unable to attend work due to illness, to facilitate their recuperation.
ii. Sick Leave can be availed by employees from the date of joining.
iii. All employees are entitled to 10 days of Sick Leave in a calendar year with full pay.
iv. Sick Leave shall be credited to the employee's leave account at the beginning of the year. For employees who join during the year, Sick Leave shall be computed on a pro-rata basis and credited to their leave account.

Guidelines
i. Whenever an employee is unable to attend duties due to illness, he / she is required to inform his / her immediate superior and / or the Function Head.
ii. On resuming work, the leave application shall be filled up and forwarded for approval and appropriate documentation.
iii. Wherever employees know of their medical requirements in advance, prior permission for Sick Leave is required.
iv. Sick Leave beyond 3 consecutive days needs to be supported by a certificate from a registered medical practitioner.
v. Sick Leave cannot be clubbed with any other leave.
vi. Any company-declared holidays / weekly offs falling during the Sick Leave period will also be counted as part of the Sick Leave.
vii. Unutilised Sick Leave can be accumulated up to a maximum of 30 days.
viii. Sick Leave cannot be encashed.
ix. On separation from the company for any reason whatsoever, if Sick Leave availed is more than the entitlement for the period served (on a pro-rata basis), such excess leave shall be adjusted against Privilege Leave or recovered from the full and final settlement.

## c. Privilege Leave

i. The purpose of Privilege Leave is to enable an employee to take a break from work. We encourage all employees to use their Privilege Leave, depending upon the exigencies of the business and subject to sanction by the concerned authority.
ii. Privilege Leave can be availed by employees after confirmation of their services.
iii. The entitlement is 21 days for every completed year of service. This leave will be credited to the employee's leave account on the 1st of January every year.
iv. For employees who join mid-year, Privilege Leave calculated on a pro-rata basis will be credited to their leave account the next January.

Guidelines
i. Every employee should indicate to his / her Function Head his / her approximate plan of availing Privilege Leave at the beginning of the year.
ii. Privilege Leave can be availed on a maximum of three occasions in a calendar year.
iii. Privilege Leave is to be taken for 4 or more days at a time.
iv. An application for Privilege Leave has to be made preferably at least 2 weeks in advance.
v. Sanction for Privilege Leave should be obtained before proceeding on leave.
vi. An application for Privilege Leave can be rejected due to exigencies of the business and / or unforeseen circumstances.
vii. Privilege Leave can be accumulated up to a maximum of 30 days.
viii. A maximum of 15 days of Privilege Leave can be encashed in a year.
ix. On separation from the company for any reason whatsoever, if Privilege Leave availed is more than the entitlement, such excess leave may be adjusted against final settlement dues.
x. If the employee has availed fewer days of Privilege Leave than his / her entitlement / balance, it will be encashed and paid along with the full and final settlement.
xi. On resignation, a maximum of 30 days of accumulated Privilege Leave can be adjusted against the notice period.

## d. Maternity Leave

i. Maternity Leave will be granted as per the Maternity Benefit Act, 1961. The total entitlement is 26 weeks' leave with full pay. This leave is applicable to women employees only.
ii. An employee who wishes to proceed on Maternity Leave should apply for leave along with a doctor's certificate. This application has to be sent to {company_short} HR through the Function Head / Reporting Manager.
iii. The employee should indicate the date on which she would like to start her Maternity Leave and the date she wishes to resume.
iv. Typically, Maternity Leave can start 8 weeks before delivery and end on completion of 8 weeks after delivery. However, the employee can choose to work as long as she deems fit before the date of delivery, and the 26 weeks will be counted from the date she actually goes on Maternity Leave.
v. To be eligible for Maternity Leave, an employee must have actually worked for at least 80 days before the expected start date of leave.
vi. In cases of miscarriage or medical termination of pregnancy, an employee, on production of such proof, will be entitled to leave with pay for a maximum period of 6 weeks.
vii. For any post-delivery complication or in case of premature birth of the child, on production of such proof, Maternity Leave may be extended by up to 4 weeks.

## e. Paternity Leave

An employee who is the proud father of a newborn child shall be eligible for Paternity Leave of 3 days (on 2 occasions only) to assist in the wellbeing of their spouse and newborn child and to meet immediate domestic exigencies. This leave may be taken once in a given year.

## f. All Purpose Leave

This leave type is applicable to probationers only. In a normal situation the probation period is three months, and all probationers are eligible for 3 days of leave during the probation period. All Purpose Leave can be availed for two consecutive days.

## g. National and festival holidays

{company_short} will observe a set of national and festival holidays for each calendar year, which will be paid holidays. The list of all such holidays will be circulated by HR.

## 5.2 Unauthorized absence / loss of pay

i. Absence from work without prior intimation / permission is termed 'unauthorized absence'.
ii. It will be deemed misconduct and can have a detrimental effect on an individual's performance review and career progress.
iii. In the event that the employee is on unauthorized absence without an explanation for a period of more than 7 days, his / her employment shall stand annulled with effect from the first day of absence.
iv. Two show-cause notices need to be sent to the employee's residential address as per Company records by registered post. Only after acknowledgement that the same has been received at the employee's end can a cessation of employment be acted upon.

## 5.3 Leave during notice period

i. As a practice, leave requests from employees will not be entertained while they are serving their notice period following formal intimation of their intention to resign. This is primarily to facilitate 'business as usual' and an efficient handover of charge.
ii. The Management may, however, considering business exigencies and corporate sensibilities, ask the employee to proceed on leave if need be.
iii. In the case of confirmed employees, only up to a maximum of 30 days of Privilege Leave (unutilised leave) shall be adjusted towards the notice period.
iv. Any exception will need the approval of the HR Head.

## 5.4 Clubbing of leave

Except where it is specifically provided for, clubbing together different types of leave will not be allowed.

## 5.5 Leave encashment

i. Privilege Leave will be accounted for up to the date of separation from the Company.
ii. Calculation will be on the basis of the last drawn basic salary only.
iii. In case of retirement, the basis of calculation will be the last drawn pay slip gross.$p$),

('code-of-conduct', 'Ethics and Business Conduct Guidelines (Code of Conduct)', 'HR/EBC/Ver1.0', 30, true, $p$# Ethics and Business Conduct Guidelines (Code of Conduct)

## Introduction

Please find given the "Ethics and Business Conduct Guidelines" to be followed at {company_short}. You are requested to read through all the clauses carefully, sign a declaration as a token of your acceptance of the guidelines at the time of your joining, and abide by them at all times.

## Conflict of interest

A conflict of interest could be defined as a "situation that arises when a decision-making authority is seen to have a personal stake in the outcome of the decision itself".

Employees of {company_short} may find themselves in situations that create a conflict of interest. If in doubt, it is always best to consult senior colleagues before taking any decision in such cases. A few such situations are listed below.

Examples of conflicts of interest which are to be avoided:
a. Holding a financial interest, directly or indirectly, including through close relatives, in a company to which business is given, or in a company in which the employee is involved in making a buy-out decision.
b. Directing business to a supplier managed by a relative or close friend.
c. Soliciting subcontractors and vendors for donations / advertisements to a charity in which the employee is involved.
d. Using company facilities for personal purposes or for a spouse's / relative's business.
e. Treating personal expenses / trips as business expenses / trips.
f. Taking a part-time job requiring the employee to spend time during normal working hours, or using office equipment, in meeting personal responsibilities.
g. Making a promotion decision about a spouse or relative.

## Participating in outside activities

{company_short} recognizes and respects the right of employees to take part in activities outside their jobs. However, these activities must be lawful and free of conflict with their responsibilities as {company_short} employees. Employees must ensure that the company's resources or influence are not misused and that no discredit is brought upon the Company's reputation.

## Relationships with customers, consultants, vendors and business associates

Employees are prohibited from entering into any kind of personal or business contract with {company_short}'s customers, consultants, vendors and business associates, except with the authority and approval of the concerned Functional Head or the Chief Executive Officer.

Employees are likely to be offered gifts of any nature in the course of their dealings with customers, consultants, vendors and business associates. The following guidelines apply:
• Small-value gifts in the nature of mementos and flowers / sweets on festive occasions are acceptable. High-value gifts in excess of Rs 500/- should be politely turned down. Generally, when it is explained that Company rules prohibit acceptance, most people will understand. If it is extremely impolite or business-sensitive to turn the gift down, it must be immediately reported to the concerned Department Head and the gift deposited with the Company.
• Buying materials / equipment from customers, business associates or vendors for personal use at high discounts is absolutely prohibited.
• Accepting free trips / holidays within India and / or abroad, by employees or for their family members, is also prohibited.
• Any violation of this guideline will be viewed as serious misconduct.

## Accepting outside directorships of firms and companies

All outside directorships should be cleared by the Chief Executive Officer's office, in writing, before acceptance.

## Employment of relatives

{company_short} does not permit employment of close relatives, as it creates a conflict of interest. Close relatives are defined as spouse, children, parents and siblings.

If any employee refers a person for employment with {company_short}, any relationship, close or otherwise, must be indicated upfront.

Close relatives in the employment of competitors should be disclosed, with details of the relationship and responsibilities held.

## Setting up a part-time business or taking up part-time employment

{company_short} expects all its employees to dedicate their time, creativity and energy to rendering services to {company_short}. Employees are therefore not permitted to set up part-time businesses or take up part-time employment, as these will impede the employee's performance and clearly place them in a conflict of interest.

## Accepting honoraria

Employees may be invited to speak / contribute at various professional forums. Any honorarium offered at such forums may be accepted if the knowledge shared is based on the employee's professional capacity, the amount involved is not material, the same has been duly intimated to the concerned Functional Head or Business Head, and no proprietary information is revealed in the talk.

## Consultancy

This should be avoided by all full-time employees of the organization.

## Handling confidential and proprietary information and intellectual property

"Confidential Information" shall mean confidential or proprietary information of the Company and includes information received by the Employee whether directly from the Company or otherwise.

Confidential Information includes, without limitation, inventions, innovations, works or intellectual property and any idea, design, trade secret, know-how or data of any nature concerning the development, use, formulation, manufacture or performance of the Company or its products or prospective products or services, and any research and development activities, processes, techniques, inventions, specifications, algorithms, prototypes, designs, drawings or test data thereof, software programs, computer programs or documentation, specifications, source code and object code of such software and computer programs, inventions, processes, engineering products, services, customers, markets or the business of the Company or that of its customers or clients, whether or not the Employee is working with the particular customer or client.

Information shall be deemed to be confidential whether it comes to the knowledge of the Employee orally or is contained in tangible or fungible form, and whether contained in a pen drive, hard drive, computer system, brochure, booklet or otherwise. Unless otherwise specified by the Company, all information received by the Employee during the employment from the Company, its group, holding or subsidiary companies, its clients or customers shall be deemed to be Confidential Information.

All employees of {company_short} must be aware of the following:
• They are in possession of Company information of a confidential character pertaining to the Company's products, formulations, inventions, designs, patterns, systems, tools and techniques, in addition to vital information about the company's customers, all of which is in the nature of Confidential and / or Proprietary Information. Under no circumstances can any of this information be discussed, parted with or shared in any form with any person, third party, firm or organisation, including but not limited to competitors of {company_short}.
• Employment in {company_short} will involve handling the intellectual property of {company_short} or its group or associate companies in any form. Employees are required to handle such information with the utmost discretion, diligence, secrecy and confidentiality, and are prohibited from disclosing or discussing any or all of such information with any unauthorized person.
• Employees must recognize and accept that the documents, papers and working materials of {company_short} constitute items of value, and take all care in their handling. They should not duplicate, or cause to be duplicated, any project-related documents, materials or magnetic media for any unauthorized use, and shall not sell, distribute or disseminate, in any manner whatsoever, any such material to any third party or unauthorized person.
• Employees are obliged not to use the Confidential Information entrusted to them for any purpose other than the business of {company_short}, including but not limited to personal use.
• Employees must keep a record of the developments made and submit the same to their superior.
• The work outputs produced during the employee's tenure with {company_short} will become the intellectual property of {company_short} or its customers, as the case may be, and the employee will have no claim over such work output. As and when called upon to do so, the employee will execute all necessary papers and otherwise provide proper assistance, at the Company's expense, during and after the employment, to enable the Company to obtain for itself or its nominees patents, designs, trademarks, copyrights or other legal protection for such works, inventions, innovations or intellectual property in any and all countries.
• {company_short} stresses again the importance of handling such confidential information, as violation of any of the above clauses will be considered serious misconduct.
• On termination of the employee's services with {company_short}, the employee must hand over all papers, documents, information and work-related files, matter and information in his / her possession to the immediate supervisor and execute a declaration to this effect.
• Considering the sensitivity of the confidential information which will come to your knowledge, you shall not engage in any activity, even after ceasing to be in employment with the Company, which will adversely affect the interest of the Company, including advising and using the information for the benefit of any party to the disadvantage of the Company.

## Non-compete and non-solicit undertaking

{company_short} processes are proprietary to {company_short} and developed through experience. During your tenure with the Company, you will be trained in and familiarized with various {company_short} processes. Working in any competing business can therefore harm {company_short}. During your tenure with {company_short}, you will not engage in any activities, in any capacity, which are in competition with the business of the company or in a related business, or which result in employing other serving employees of the Company.

You shall not at any time within six months after the cessation of your employment with the Company, either directly or indirectly, or through any proprietary firm or partnership firm in which you are a partner, or through any company in which you are a shareholder or director, or associated in any manner whatsoever, solicit or seek to employ or appoint as agent, or associate with, any employee or officer of the Company, unless a period of six months has elapsed since the date of separation of the concerned employee, agent or associate, or unless specifically approved by the Chief Executive of the Company.

You shall also not request, encourage or cause any past, present or prospective customer, supplier, employee or independent contractor to withdraw, curtail or cancel a business relationship with the Company, or otherwise interfere in any manner with the relationship between the Company and such past, present or prospective customer, supplier, employee or independent contractor.

Additionally, during the restricted period, the Employee shall not directly or indirectly contact any Customer (as defined herein) or prospective Customer for the purpose of introducing, offering or selling to such Customer any products or services that compete with the products and / or services offered by the Company, and the Employee shall not directly or indirectly accept business from, do business with or service, or indirectly aid or assist anyone else in the solicitation or acceptance of business from, any Customer or prospective Customer to the extent that such business competes with the products and / or services offered by the Company. For the purposes of this paragraph, "Customer" shall mean anyone with whom the Company has had negotiations during a period of one year before the termination of employment with the Company.

Please note that your accepting employment with {company_short} is subject to your accepting this specific non-compete and non-solicit clause.

## Representing the Company

• Employees are prohibited from speaking to the press on any subject unless authorized to do so by the Board or the Chief Executive Officer. All questions or requests for information from the press should be directed to the person authorized to speak to the press.
• Employees may be invited to speak at professional forums, participate in conferences or seminars, or write in professional magazines. In all such circumstances, employees must clarify that the views expressed by them are purely their personal views and do not represent the views of {company_short}.
• Employees must represent the Company strictly in accordance with the roles and duties assigned. They must not make commitments, under any circumstances, beyond what they are authorised to.

## Network security and usage

{company_short} provides computing and communication facilities, including internal network and Internet access ("Network facilities"), to employees solely for their work in the Company, in order to complete the responsibilities assigned to them in the course of their employment. In addition, judicious use of these facilities is permitted to enable employees to become better informed and more productive at work. Employees are expected to be aware at all times that the Network facilities are the Company's business tools and are to be used solely for achieving the Company's business goals and objectives. However, the Company understands the need for sending / receiving personal mail to a reasonable extent, not conflicting with the Company's business interests.

The facilities and nature of access provided will depend on an employee's level and responsibilities. Employees with access to Network facilities must take particular care to understand the copyright, trademark, libel, slander and public speech control laws of all countries, so that use of the Network facilities does not inadvertently violate any laws which may be enforceable against the Company.

The Network facilities are susceptible to misuse; it should be the endeavour of every employee to safeguard these facilities against misuse, wilful or otherwise. It is only through such total and sustained discipline on the part of every employee that the Company reaps the benefits of the Network facilities without compromising its security. The overriding principle is that the security of the network is everyone's first concern.

The Company's network security and usage policies are based on this principle. The specific policy provisions are listed below. The HR Department will implement and interpret this policy, and its decision will be final.
• The workstation hardware, software and network resources, such as server access, Internet mail, web, FTP and other access, are to be used by every person only for the official work being performed by them in the Company. However, employees may use Network facilities for research or browsing in relation to their technical learning outside regular working hours. They should not use the facilities for personal gain, including posting resumes, soliciting job offers or furthering personal business interests.
• Employees should not use the Company's facilities to download and install or distribute any software or data. Specific materials, documents and manuals for the purpose of work can, however, be downloaded by employees. Any such files or software may be used only in ways that are consistent with their licences or copyrights.
• The Company has the right to inspect any and all files stored on any workstation, server or any area of the Company's network. The Company will conduct routine audits of all hardware and software installed on every system and any files or data.
• The Company has installed a variety of security systems, including firewalls, proxies and Internet address screening programs, to protect the security of the network. Employees should not attempt to circumvent, disable or overload the network or any system intended to protect the privacy or security of the computers or the network, except when required in the course of their official duties. Any attempt to do so will be treated as misconduct.
• Employees should use only software provided by the Company, since use of unauthorized software represents a serious threat to the security of the network.
• Employees should not knowingly propagate any virus or worm. In the event of any employee coming to know of such a virus / worm on his or her computer, it should be reported to the Systems Department / Administrator immediately.
• Employees should not use Network / e-mail facilities to store or propagate material that is: 1. sexually explicit or inappropriate; 2. derogatory or offensive; 3. racist, casteist or communal, political, religious, or bordering on superstition or the occult; 4. disparaging of the Company, its employees, associates, customers, clients, policies or procedures; 5. jokes, stories and similar material; 6. for amusement or for playing games and trading.

The Company reserves the right to block access to any website, including those providing the above. In the case of subjects under 1, 2, 3 and 4, employees risk invocation of the "termination from employment" clause if found indulging in the same. In case any employee inadvertently visits such sites, he or she should immediately disconnect from that site.
• Employees should not use, store or transmit to anyone else, in any manner, any software, data, proposals, design documents, technical specifications or customer requirements unless it is required for the performance of their work.
• Employees should not transmit Company information of any kind, including Company confidential, financial, marketing or human resources information, to anyone else unless authorized to do so.
• Employees should be especially conscious of intellectual property when using any software, data, proposals, design documents, technical specifications, customer requirements, documents or manuals, whether provided by the Company or by any of its associates, customers or clients. Such material should be used only for the specific purpose and specific customer project activity for which it has been given to them.
• Sharing of software, data or files between machines on the network should be done with care and adequate protections / precautions, and only for a specific purpose, without violating any confidentiality or intellectual property of the Company or its customers, vendors, prospects and associates.
• The Company reserves the right to monitor and record all network traffic, including e-mail, chat or newsgroup messages. No employee should have any expectation of privacy as to his or her network usage. The Systems Department is empowered to do random checks periodically and, if necessary, will record all activity, analyze usage patterns and may present this data to HR.
• The Company reserves the right to block or filter network traffic based on criteria such as size, subject matter, source or destination.
• The Company's Network facilities should not be used knowingly to violate the laws of the Republic of India or of any other nation, state or local body. Use of Company resources for any illegal activity will be treated as misconduct. The Company will comply with reasonable requests from law enforcement and regulatory agencies for logs, diaries or archives of an individual's network activities or usage of Network facilities.
• Any employee using the Network facilities is required to identify themselves honestly, completely and accurately when participating in chats or newsgroups or when setting up internally authorized accounts on outside computer systems.
• The Company retains the copyright to any material posted to any forum, newsgroup, chat or World Wide Web page by any employee.
• Using the Company's Network facilities to commit infractions such as misuse of the Company's assets or resources, sexual harassment, or misappropriation or theft of intellectual property is also prohibited; any such infraction will be treated as misconduct.
• While browsing the Internet or participating in chats or newsgroups, employees should be conscious that these are public forums where it is inappropriate to reveal confidential company information, customer data or any other material deemed to be intellectual property.
• While browsing the Internet, participating in chats or newsgroups, or submitting material or contributions to standards bodies, conferences and similar institutions, employees should not claim to represent the Company or any of its subsidiaries, associates, partners or customers unless explicitly authorized to do so by the Company. Employees who are so authorized to represent the Company should refrain from any political advocacy and from endorsing any product or service not sold or marketed by the Company or any of its subsidiaries, associates, partners or customers.
• Whenever any employee comes across any violation of the network security and usage policy by any employee or outside person, he or she is expected to immediately inform their Department Head or HR about such misuse.
• The HR Department will, in consultation with the Systems / Technology Department, review these policy provisions periodically, and any changes will be communicated to every employee by the HR Department.
• The right of final interpretation of material stored or propagated, in the event of any ambiguity, vests with the Head of HR.

## Conduct at the workplace

{company_short} is committed to a positive, productive environment for all employees. It is the Company's goal to maintain a certain disciplinary standard.

{company_short} respects all religions. The Company recognizes the subject of religious faith as one that is private and personal to each individual. The workplace shall be maintained by employees in a manner free from any kind of religious or cult leanings and symbols, idols, images or rituals that are reflective of religious preferences.

## Inappropriate conduct / misconduct

Inappropriate conduct at the workplace shall include, but will not be confined to, the following:
1. Absence from work without informing your manager in charge.
2. Reporting late to work on a habitual basis – more than once in a month.
3. Behaviour or acts not in conformance with {company_short}'s stated value system.
4. Misuse of Company resources, funds and infrastructure.
5. Making false claims and declarations.
6. Abusing, threatening or assaulting a fellow employee within or outside the Company premises.
7. Smoking in the office and prohibited areas.
8. Refusal to accept any communication from the Management.
9. Non-compliance with any administrative procedure / system established for the effective working of the organization or its departments.

## Harassment at the workplace

It is the policy of the company to prohibit any form of harassment at the workplace. The objective of this policy is to provide a work environment that fosters mutual employee respect and working relationships free of harassment. {company_short} specifically prohibits any form of harassment by or towards employees, contractors, suppliers or customers.

Under the Company's policy, harassment is any inappropriate, unwanted conduct which has the purpose or effect of:
• Violating the dignity of a person or creating an intimidating, hostile, degrading, humiliating or offensive work environment;
• Deliberately or purposely violating a person's privacy or mental / physical well-being;
• Unreasonably interfering with an individual's work performance, or deliberately making irrational or unreasonable demands on work outputs with a view to inducing stress.

No retaliation will be taken against any employee because he or she reports a problem concerning possible acts of harassment. Employees can raise concerns and make reports without fear of reprisal. Questions about what constitutes harassing behaviour should be directed to the employee's supervisor, department head or the HR contact.

## Sexual harassment

The Supreme Court of India has laid down stringent rules in this regard. Equality in employment can be seriously impaired when employees, particularly women, are subjected to gender-specific harassment such as sexual harassment at the workplace. Such conduct is discriminatory when the employee has reasonable grounds to believe that his / her objection would disadvantage him / her in connection with his / her employment, including recruitment or promotion, or when it creates a hostile working environment.

Refer to the Prevention of Sexual Harassment (POSH) Policy for the complete policy details and information.

## Substance abuse

The Company is committed to a safe, healthy and productive workplace for all employees. The Company recognizes that alcohol, drug or other substance abuse by employees may impair their ability to perform properly and will have serious adverse effects on the safety, efficiency and productivity of other employees and the Company as a whole. The following is strictly prohibited and is grounds for termination:
• Unlawful possession, use, solicitation, sale, manufacture or purchase of any drugs, narcotics or other intoxicants in any amount while at work or at any of the Company premises at any time.
• Being present at the workplace or at any Company / supplier / customer premises at any time under the influence of alcohol, narcotics or any other intoxicants.
• {company_short} holds the right to conduct a random alcohol / drug test at any point during the employee's tenure with the Company.

## Security administration

{company_short} has a security administration system meant for the safety and security of the company and its employees. Employees are requested to cooperate with the security personnel to help them discharge their duties. This includes the following:
1. Having visitors record their entry and exit in the visitors register.
2. Meeting visitors at the reception, lobby or designated place, and not having them move around in restricted areas.
3. Not carrying any papers, documents, CDs, pen / hard drives, tapes or any other data storage devices in and out of the premises without prior permission.
4. Complying with any other guidelines that may be introduced from time to time.

This list is only illustrative and not exhaustive. {company_short} reserves the right to introduce and communicate other guidelines from time to time.

## How to raise issues / concerns – broad guidelines

Issues concerning compliance with the company's policies and standards of business conduct should be raised through your line management structure. However, if for any reason you feel an issue cannot be raised through the normal process, you can approach the Head of HR or the Chief Executive Officer, who will ensure that the name of the person raising the concern is kept confidential.

## Business conduct violations

Business conduct violation refers to acts of:
• Non-compliance with the {company_short} rules at each premises.
• Going against the standards of discipline.
• Acting to the detriment of the interests of the organisation.
• Deviating from the established standards of behaviour expected at the workplace.

Acts that constitute business conduct violations are applicable to all employees working in {company_short} and are detailed above.

## Dealing with business conduct violations

{company_short} is charged with the responsibility of taking appropriate corrective action in the event of a business conduct violation. As a responsible employer, {company_short} will:
• Thoroughly investigate the nature and gravity of the violation to establish the facts.
• Give you an opportunity to explain your point of view.
• Look at your past record at {company_short}.

Based on these three inputs, {company_short} will take action as it considers appropriate. Actions can vary from a simple verbal or written warning to termination of services, depending on the seriousness of the act or the frequency of its occurrence.

It must be remembered that you need to comply with the Business Conduct Guidelines in both letter and spirit. Conformance in letter and not in spirit is not adequate for a productive workplace. Loss of faith in your conformance with the Business Conduct Guidelines is quite often reason enough for disciplinary action, including termination of services.$p$),

('posh', 'Prevention of Sexual Harassment (POSH) Policy', 'HR/POSH/Ver1.0', 40, true, $p$# Prevention of Sexual Harassment (POSH) Policy

HR will add the full POSH policy here. Until then, please speak to HR for a copy.$p$),

('acknowledgement', 'Acknowledgement, Acceptance & Agreement', 'HR/ACK/Ver1.0', 90, true, $p$# Acknowledgement, Acceptance & Agreement

I, {full_name}, acknowledge that I have received a copy of {company_short}'s following documents:

{policy_list}

I have read the aforementioned documents, I understand them, and I agree to abide by the policies that are set forth therein.

I recognize and understand that {company_short}'s policies and systems are to be used for conducting {company_short}'s business only and cannot be shared publicly. I understand that the policies and Code of Conduct apply to me, and I am aware that any violation of these policies may subject me to disciplinary action, up to and including the termination of my employment, as well as legal action.

I agree to indemnify, defend and hold harmless {company_short}, and its officers and other employees, from and against any damage, harm and liability arising out of a breach of the policies by me or due to any negligence on my part.

Furthermore, I understand that the policies may be amended at any time by {company_short}. I further acknowledge that any future changes to the policies may be communicated to me through physical or electronic means.

In acceptance of the above,

Full name: {full_name}
Signature: ______________________________
Date: {date}$p$)
on conflict (slug) do nothing;
