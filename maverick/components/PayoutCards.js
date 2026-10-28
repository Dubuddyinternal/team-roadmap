import Icon from './Icon';
import { fmtShort, money } from '@/lib/config';

export function payoutTotals(payouts) {
  const paid = payouts.filter((p) => p.status === 'paid');
  const pending = payouts.filter((p) => p.status === 'pending');
  const sum = (list) => list.reduce((a, p) => a + Number(p.amount || 0), 0);
  const nextDue = pending
    .map((p) => p.due_on)
    .filter(Boolean)
    .sort()[0];
  return {
    basePaid: sum(paid.filter((p) => p.kind === 'base')),
    baseCount: paid.filter((p) => p.kind === 'base').length,
    bonusPaid: sum(paid.filter((p) => p.kind === 'bonus')),
    pending: sum(pending),
    nextDue,
  };
}

export default function PayoutCards({ payouts }) {
  const t = payoutTotals(payouts);
  return (
    <div className="wcards">
      <div className="wcard" style={{ background: 'var(--yes-tint)' }}>
        <b className="tnum">{money(t.basePaid)}</b>
        <span>
          Base pay paid · {t.baseCount} {t.baseCount === 1 ? 'video' : 'videos'}
        </span>
        <Icon name="d-check" className="ic" />
      </div>
      <div className="wcard" style={{ background: 'var(--tint)' }}>
        <b className="tnum">{money(t.bonusPaid)}</b>
        <span>Bonus paid</span>
        <Icon name="d-trophy" className="ic" />
      </div>
      <div className="wcard" style={{ background: '#FFF3D6' }}>
        <b className="tnum">{money(t.pending)}</b>
        <span>Pending payout{t.nextDue ? ` · ${fmtShort(t.nextDue)}` : ''}</span>
        <Icon name="d-clock" className="ic" />
      </div>
    </div>
  );
}
