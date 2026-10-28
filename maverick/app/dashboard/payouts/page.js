'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import PayoutCards, { payoutTotals } from '@/components/PayoutCards';
import { useDash } from '@/components/DashboardShell';
import { getSupabase } from '@/lib/supabase';
import { T, fmtDate, fmtShort, money } from '@/lib/config';

function UpiCard({ creator, onSaved }) {
  const [editing, setEditing] = useState(!creator.upi_id);
  const [upi, setUpi] = useState(creator.upi_id || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const v = upi.trim();
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v)) {
      setErr('That does not look like a UPI ID. It looks like name@bank.');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await getSupabase().from('maverick_creators').update({ upi_id: v }).eq('id', creator.id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(false);
    onSaved();
  }

  return (
    <div className="card row">
      <Icon name="d-upi" style={{ width: '62px', height: '62px', color: 'var(--blue)', flex: 'none' }} />
      <div className="grow">
        <p className="lbl">Your UPI ID, saved here</p>
        {editing ? (
          <>
            <input className={`inp${err ? ' bad' : ''}`} placeholder="yourname@okaxis" value={upi} onChange={(e) => setUpi(e.target.value)} />
            {err && <p className="errtext">{err}</p>}
          </>
        ) : (
          <b style={{ fontSize: '24px', wordBreak: 'break-all' }}>{creator.upi_id}</b>
        )}
        <p className="sm mut" style={{ marginTop: '4px' }}>
          Every payout goes to this ID. This is the only place it is saved.
        </p>
      </div>
      {editing ? (
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      ) : (
        <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>
          Change
        </button>
      )}
    </div>
  );
}

export default function PayoutsPage() {
  const { creator, payouts, reload } = useDash();
  const t = payoutTotals(payouts);
  const history = payouts.filter((p) => p.status === 'paid').sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)));

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Payouts</h1>
          <p className="lead" style={{ marginTop: '6px' }}>
            Base pay and the view bonus are paid separately, on different clocks.
          </p>
        </div>
      </div>

      <PayoutCards payouts={payouts} />

      <div className="two mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <UpiCard key={creator.upi_id || 'none'} creator={creator} onSaved={reload} />
        <div className="card row" style={{ background: 'var(--tint)' }}>
          <Icon name="d-cal" style={{ width: '62px', height: '62px', color: 'var(--coral)', flex: 'none' }} />
          <div>
            <p className="lbl">Next payout run</p>
            <b style={{ fontSize: '24px' }}>{t.pending > 0 ? `${t.nextDue ? fmtShort(t.nextDue) + ' · ' : ''}${money(t.pending)}` : 'Nothing pending yet'}</b>
            <p className="sm mut">
              Base pay {T.baseDays} after publishing · bonus {T.bonusDays} after publishing
            </p>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '24px', margin: '34px 0 16px' }}>Payment history</h3>
      {history.length === 0 ? (
        <div className="empty">
          <p className="md">No payments yet.</p>
          <p className="sm mut" style={{ marginTop: '6px' }}>
            Your first one lands {T.baseDays} after your first approved video is published.
          </p>
        </div>
      ) : (
        <div className="tscroll">
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Date of payment</th>
                <th>Type</th>
                <th>Sent to UPI ID</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="tnum">{fmtDate(p.paid_at)}</td>
                  <td>{p.kind === 'bonus' ? 'View bonus' : 'Base pay'}</td>
                  <td>{p.upi_id || creator.upi_id}</td>
                  <td>
                    <b className="tnum">{money(p.amount)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card soft mt row">
        <Icon name="d-bubble" style={{ width: '52px', height: '52px', color: 'var(--coral)', flex: 'none' }} />
        <div>
          <b style={{ fontSize: '20px', display: 'block' }}>Money not arrived?</b>
          <p className="sm mut">If your payout has not arrived, open Help and write to us. We reply within {T.supportSLA}.</p>
        </div>
        <Link href="/help" className="btn sm" style={{ marginLeft: 'auto' }}>
          Open help
        </Link>
      </div>
    </>
  );
}
