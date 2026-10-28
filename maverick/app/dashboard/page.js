'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import PayoutCards, { payoutTotals } from '@/components/PayoutCards';
import { useDash } from '@/components/DashboardShell';
import { getSupabase } from '@/lib/supabase';
import { CFG, T, addDays, fmtDate, fmtShort, money } from '@/lib/config';
import { platformLabel, statusOf } from '@/lib/status';

const NOT_YET = <td className="mut">Not yet</td>;

function ext(url, label) {
  return url ? (
    <a className="linkcell" href={url} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : null;
}

function PublishBox({ sub, onClose, onDone }) {
  const [link, setLink] = useState('');
  const [channel, setChannel] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!/^https?:\/\/\S+\.\S+/.test(link.trim())) {
      setErr('Paste the full link of the published video.');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await getSupabase()
      .from('maverick_submissions')
      .update({ published_link: link.trim(), channel_link: channel.trim() || null })
      .eq('id', sub.id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
    onDone();
  }

  return (
    <div className="publishbox">
      {!sent ? (
        <div>
          <div className="row">
            <Icon name="d-check" style={{ width: '44px', height: '44px', color: 'var(--yes)', flex: 'none' }} />
            <div className="grow">
              <h3>{sub.title}</h3>
              <p className="sm mut">Your video has been approved for publishing. Publish it, then tell us where it went live.</p>
            </div>
            <span className="skip sm" onClick={onClose} role="button">
              Close
            </span>
          </div>
          <div className="two mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="lbl">I have published it</span>
              <input className="inp" placeholder="Paste the published video link" value={link} onChange={(e) => setLink(e.target.value)} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="lbl">Published on this channel</span>
              <input className="inp" placeholder="Paste your channel link" value={channel} onChange={(e) => setChannel(e.target.value)} />
            </label>
          </div>
          {err && <p className="errtext">{err}</p>}
          <button className="btn lg mt" onClick={send} disabled={busy}>
            {busy ? 'Sending…' : 'Submit for review'}
          </button>
        </div>
      ) : (
        <div className="row">
          <Icon name="d-check" style={{ width: '52px', height: '52px', color: 'var(--yes)', flex: 'none' }} />
          <div>
            <h3>Sent to us.</h3>
            <p className="md" style={{ marginTop: '4px' }}>
              Your payout will be generated within {T.baseDays}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { creator, submissions, payouts, reload } = useDash();
  const [info, setInfo] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const first = (creator.full_name || '').split(' ')[0];
  const { nextDue } = payoutTotals(payouts);

  function paidAmount(subId, kind) {
    const p = payouts.find((x) => x.submission_id === subId && x.kind === kind && x.status === 'paid');
    return p ? <b className="tnum">{money(p.amount)}</b> : null;
  }

  return (
    <>
      {!creator.upi_id && (
        <div className="upinote">
          <Icon name="d-upi" />
          <span>Please save your UPI ID in the Payouts section.</span>
          <Link href="/dashboard/payouts" className="btn sm">
            Open Payouts
          </Link>
        </div>
      )}

      <div className="dhead">
        <div>
          <h1>{first ? `Hi, ${first}.` : 'Hi there.'}</h1>
          {nextDue && (
            <div className="row" style={{ marginTop: '10px' }}>
              <span className="sm mut">
                Next payout <b>{fmtShort(nextDue)}</b>
              </span>
            </div>
          )}
        </div>
        <Link href="/dashboard/submit" className="btn lg" style={{ marginLeft: 'auto' }}>
          Submit a video
        </Link>
      </div>

      <PayoutCards payouts={payouts} />

      <h3 style={{ fontSize: '24px', margin: '36px 0 6px' }}>My videos</h3>
      <p className="sm mut" style={{ marginBottom: '16px' }}>
        Everything you submitted, with where it has reached. Click an approved video to add your published link.
      </p>

      {submissions.length === 0 ? (
        <div className="empty">
          <Icon name="d-cam" style={{ width: '64px', height: '64px', color: 'var(--coral)' }} />
          <h3 style={{ fontSize: '24px', marginTop: '14px' }}>No videos yet.</h3>
          <p className="sm mut" style={{ marginTop: '6px' }}>
            Film one, paste the Drive link, and it shows up here. Your first {T.base} is one video away.
          </p>
          <div className="row" style={{ justifyContent: 'center', marginTop: '20px' }}>
            <Link href="/dashboard/submit" className="btn">
              Submit my first video
            </Link>
            <Link href="/how-it-works" className="linkbtn" style={{ color: 'var(--coral)' }}>
              What to film →
            </Link>
          </div>
        </div>
      ) : (
        <div className="tscroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>S. No.</th>
                <th>Video name</th>
                <th>Drive link</th>
                <th>Published link</th>
                <th>Platform</th>
                <th>Channel</th>
                <th>Submitted for approval</th>
                <th>Date published</th>
                <th>{CFG.bonusWindow}-day window completes</th>
                <th>Base pay</th>
                <th>Bonus</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, i) => {
                const st = statusOf(s, payouts);
                const live = !!s.published_at;
                return (
                  <tr
                    key={s.id}
                    style={st.key === 'approved' ? { cursor: 'pointer' } : undefined}
                    onClick={(e) => {
                      if (st.key === 'approved' && !e.target.closest('.infobtn, .infopop, a')) setPublishing(s);
                    }}
                  >
                    <td className="tnum">{submissions.length - i}</td>
                    <td>
                      <Link href={`/dashboard/videos/${s.id}`} style={{ fontWeight: 600 }}>
                        {s.title}
                      </Link>
                    </td>
                    <td>{ext(s.drive_link, 'Drive link')}</td>
                    {s.published_link ? <td>{ext(s.published_link, 'Published link')}</td> : NOT_YET}
                    {live ? <td>{platformLabel(s.platform)}</td> : NOT_YET}
                    {s.channel_link ? <td>{ext(s.channel_link, 'Channel')}</td> : NOT_YET}
                    <td className="tnum">{fmtDate(s.created_at)}</td>
                    {live ? <td className="tnum">{fmtDate(s.published_at)}</td> : NOT_YET}
                    {live ? <td className="tnum">{fmtDate(addDays(s.published_at, CFG.bonusWindow))}</td> : NOT_YET}
                    {paidAmount(s.id, 'base') ? <td>{paidAmount(s.id, 'base')}</td> : NOT_YET}
                    {paidAmount(s.id, 'bonus') ? <td>{paidAmount(s.id, 'bonus')}</td> : NOT_YET}
                    <td className="wrapcell">
                      <div className="strow">
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                        {['approved', 'rejected', 'published', 'needs_info'].includes(st.key) && (
                          <button
                            className="infobtn inline"
                            aria-expanded={info === s.id}
                            aria-label="About this status"
                            onClick={() => setInfo(info === s.id ? null : s.id)}
                          >
                            i
                          </button>
                        )}
                      </div>
                      {st.key === 'approved' && (
                        <p className="sm" style={{ color: 'var(--yes)', fontWeight: 600, marginTop: '6px' }}>
                          Click the status to add your published link.
                        </p>
                      )}
                      {info === s.id && (
                        <div className="infopop">
                          {st.key === 'approved' && (
                            <>
                              <b>Approved, ready to publish</b>Publish it on your channel, then click this row and add the
                              published link along with your channel link.
                            </>
                          )}
                          {st.key === 'rejected' && (
                            <>
                              <b>Reason</b>
                              {s.reviewer_note || 'Open the video for details.'} Make the change and submit it again as a
                              fresh submission.
                            </>
                          )}
                          {st.key === 'needs_info' && (
                            <>
                              <b>Reviewer asks</b>
                              {s.reviewer_note || 'Open the video to reply.'}
                            </>
                          )}
                          {st.key === 'published' && (
                            <>
                              <b>Published</b>Your video is under verification. After {T.baseDays}, your base pay is
                              released.
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {publishing && (
        <PublishBox
          key={publishing.id}
          sub={publishing}
          onClose={() => setPublishing(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
