/* How a submission's status shows up for the creator.
   Base pay and bonus come from maverick_payouts, so a paid payout
   moves the label on without anyone touching the submission. */
export function statusOf(sub, payouts) {
  const mine = (payouts || []).filter((p) => p.submission_id === sub.id && p.status === 'paid');
  if (mine.some((p) => p.kind === 'bonus')) return { key: 'bonus_paid', label: 'Bonus released', badge: 'app' };
  if (mine.some((p) => p.kind === 'base')) return { key: 'base_paid', label: 'Base pay released', badge: 'app' };
  switch (sub.status) {
    case 'approved':
      return { key: 'approved', label: 'Approved, ready to publish', badge: 'app' };
    case 'rejected':
      return { key: 'rejected', label: 'Rejected', badge: 'rej' };
    case 'needs_info':
      return { key: 'needs_info', label: 'Needs info', badge: 'paid' };
    case 'published':
      return { key: 'published', label: 'Published', badge: 'paid' };
    default:
      return { key: 'in_review', label: 'Under review', badge: 'rev' };
  }
}

export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'other', label: 'Other' },
];

export function platformLabel(v) {
  const p = PLATFORMS.find((x) => x.value === v);
  return p ? p.label : v || '';
}
