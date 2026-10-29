-- =====================================================================
-- STAGE 22d — The senior's feedback on a month
--
-- Besides the review-meeting notes, the person's senior (anyone above them
-- in My Team → Reporting lines, or a super-admin) fills a short review of
-- that month's feedback: an overall rating (1–5), what went well, what to
-- improve, the personality traits they see in the person, the focus for
-- next month and how they'll support them. It stays a draft until they
-- press Share; then the person sees it (📈 My Performance → Monthly feedback
-- → 4 · Senior's feedback) and gets a 🔔.
--   monthly_feedback.manager_review = { rating, well, improve, traits_pos[], traits_neg[],
--                                      focus, support, shared, shared_at, by }
-- Run after stage16a. Safe to run again.
-- =====================================================================

alter table public.monthly_feedback add column if not exists manager_review jsonb;

create or replace function public.feedback_manager_review(p_id uuid, p_review jsonb, p_share boolean)
returns public.monthly_feedback language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.monthly_feedback; was boolean; rv jsonb; who text;
begin
  select * into r from public.monthly_feedback f where f.id = p_id;
  if not found or r.status <> 'submitted' then raise exception 'That feedback isn''t sent yet.'; end if;
  if r.user_id = me then raise exception 'Your seniors write the senior''s feedback on your month.'; end if;
  if not (public.is_super() or r.user_id in (select public.fb_reports(r.team_slug))) then raise exception 'Not allowed.'; end if;
  if p_review is null or jsonb_typeof(p_review) <> 'object' or length(p_review::text) > 20000 then raise exception 'The review is too long.'; end if;
  was := coalesce((r.manager_review->>'shared')::boolean, false);
  rv := p_review || jsonb_build_object('by', me, 'updated_at', now(),
          'shared', was or coalesce(p_share, false),
          'shared_at', case when was then r.manager_review->'shared_at' when p_share then to_jsonb(now()) else null end);
  update public.monthly_feedback f set manager_review = rv where f.id = p_id returning * into r;
  if p_share and not was then
    select coalesce(nullif(p.profile->>'displayName', ''), p.name, 'Your senior') into who from public.profiles p where p.id = me;
    insert into public.team_notifications (team_slug, title, body, audience, recipients, bell, popup, created_by)
    values (r.team_slug,
            left('📋 ' || who || ' shared their feedback on your ' || to_char(to_date(r.month || '-01', 'YYYY-MM-DD'), 'FMMonth'), 140),
            'Read it in 📈 My Performance → My monthly feedback → 4 · Senior''s feedback.',
            'people', array[r.user_id], true, false, me);
  end if;
  return r;
end $$;

revoke execute on function public.feedback_manager_review(uuid, jsonb, boolean) from public, anon;
grant execute on function public.feedback_manager_review(uuid, jsonb, boolean) to authenticated;
