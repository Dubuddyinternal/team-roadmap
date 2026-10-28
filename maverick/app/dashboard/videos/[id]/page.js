'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Icon from '@/components/Icon';
import Ladder from '@/components/Ladder';
import { useDash } from '@/components/DashboardShell';
import { getSupabase } from '@/lib/supabase';
import { CFG, T, addDays, fmtShort, slabFor } from '@/lib/config';
import { platformLabel, statusOf } from '@/lib/status';

/* steps: [{ label, date, state: 'done' | 'now' | 'todo', icon, color }] */
function Track({ steps }) {
  const doneIdx = steps.reduce((a, s, i) => (s.state !== 'todo' ? i : a), 0);
  const width = steps.length > 1 ? Math.round((doneIdx / (steps.length - 1)) * 100) : 0;
  const edge = 50 / steps.length;
  return (
    <div className="card soft" style={{ padding: '40px 30px 44px', marginTop: '24px' }}>
      <div className="htl" style={{ gridTemplateColumns: `repeat(${steps.length},1fr)` }}>
        <div className="hline" style={{ left: `${edge}%`, width: `${100 - 2 * edge}%` }}>
          <i style={{ width: `${width}%` }} />
        </div>
        {steps.map((s) => (
          <div key={s.label} className={`hstep ${s.state === 'todo' ? '' : s.state}`}>
            <div className="dot" style={s.bad ? { background: 'var(--no)' } : undefined}>
              <Icon name={s.icon} style={{ color: s.state === 'todo' ? '#C9C2BD' : '#fff' }} />
            </div>
            <h4>{s.label}</h4>
            <p>{s.date || ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Confetti() {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    const cols = ['#F1684C', '#3599FF', '#FFC53D', '#17A673'];
    setBits(
      Array.from({ length: 18 }, (_, c) => ({
        left: 4 + Math.random() * 92 + '%',
        background: cols[c % 4],
        animationDelay: Math.random() * 3 + 's',
        animationDuration: 2.2 + Math.random() * 1.8 + 's',
      })),
    );
  }, []);
  return (
    <div className="confetti">
      {bits.map((b, i) => (
        <i key={i} style={b} />
      ))}
    </div>
  );
}

function Reply({ sub, onSent }) {
  const [text, setText] = useState(sub.creator_reply || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await getSupabase().from('maverick_submissions').update({ creator_reply: text.trim() }).eq('id', sub.id);
    setBusy(false);
    setMsg(error ? error.message : 'Sent. The reviewer will pick it up from here.');
    if (!error) onSent();
  }
  return (
    <div className="card soft">
      <p className="lbl">Reviewer{sub.reviewed_at ? ` · ${fmtShort(sub.reviewed_at)}` : ''}</p>
      <p className="md" style={{ marginTop: '10px' }}>
        &ldquo;{sub.reviewer_note || 'We have a question about this video.'}&rdquo;
      </p>
      <label className="field mt">
        <span className="lbl">Your reply</span>
        <textarea className="inp" rows={3} style={{ resize: 'vertical' }} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send reply'}
        </button>
        <span className="sm mut">{msg || 'Nothing else changes. No resubmission used.'}</span>
      </div>
    </div>
  );
}

export default function VideoPage() {
  const { id } = useParams();
  const { creator, submissions, payouts, reload } = useDash();
  const sub = submissions.find((s) => String(s.id) === String(id));

  if (!sub) {
    return (
      <div className="empty">
        <p className="md">We could not find this video.</p>
        <Link href="/dashboard" className="btn sm mt">
          Back to my videos
        </Link>
      </div>
    );
  }

  const st = statusOf(sub, payouts);
  const sent = sub.created_at;
  const reviewBy = addDays(sent, 4);
  const published = sub.published_at;
  const head = (
    <p className="lead" style={{ marginTop: '6px' }}>
      {platformLabel(sub.platform)} · submitted {fmtShort(sent)}
    </p>
  );

  if (st.key === 'in_review') {
    return (
      <>
        <div className="dhead">
          <div>
            <h1>{sub.title}</h1>
            {head}
          </div>
          <span className="badge rev" style={{ fontSize: '16px', padding: '10px 20px', marginLeft: 'auto' }}>
            In review
          </span>
        </div>
        <div className="alert info" style={{ alignItems: 'center' }}>
          <Icon name="d-clock" style={{ color: 'var(--blue)' }} />
          <div>
            <b>Submitted. A reviewer has it.</b>
            <p>
              Next: a result by {fmtShort(reviewBy)}, {T.reviewSLA} from submission. Keep the Drive link open to anyone
              with the link.
            </p>
          </div>
        </div>
        <Track
          steps={[
            { label: 'Submitted', date: fmtShort(sent), state: 'done', icon: 'd-check' },
            { label: 'In review', date: `by ${fmtShort(reviewBy)}`, state: 'now', icon: 'd-clock' },
            { label: 'Approved', state: 'todo', icon: 'd-star' },
            { label: `Base ${T.base}`, state: 'todo', icon: 'd-coin' },
            { label: `Day-${T.day30} bonus`, state: 'todo', icon: 'd-trophy' },
          ]}
        />
        <div className="row mt" style={{ gap: '20px' }}>
          <div className="card soft grow row">
            <Icon name="d-bubble" style={{ width: '48px', height: '48px', color: 'var(--coral)', flex: 'none' }} />
            <div>
              <b style={{ fontSize: '20px', display: 'block' }}>Nothing to do now.</b>
              <p className="sm mut">Once it is approved, publish it and keep it live for {T.day30} days.</p>
            </div>
          </div>
          <Link href="/dashboard/submit" className="btn lg">
            Submit another
          </Link>
        </div>
      </>
    );
  }

  if (st.key === 'rejected') {
    return (
      <>
        <div className="result" style={{ background: 'var(--no-tint)' }}>
          <Icon name="d-cross" style={{ width: '96px', height: '96px', color: 'var(--no)', flex: 'none' }} />
          <div>
            <h2>{sub.reviewer_note || 'We could not approve this one.'}</h2>
            <p className="lead" style={{ marginTop: '8px' }}>
              Make the change, then send it again as a fresh submission from Submit a video.
            </p>
          </div>
          <Link href="/dashboard/submit" className="btn lg" style={{ marginLeft: 'auto' }}>
            Fix and resubmit
          </Link>
        </div>
        <Track
          steps={[
            { label: 'Submitted', date: fmtShort(sent), state: 'done', icon: 'd-check' },
            { label: 'Rejected', date: fmtShort(sub.reviewed_at), state: 'now', icon: 'd-cross', bad: true },
            { label: 'Approved', state: 'todo', icon: 'd-star' },
            { label: `Base ${T.base}`, state: 'todo', icon: 'd-coin' },
          ]}
        />
        <div className="card soft mt">
          <div className="row">
            <Icon name="d-flag" style={{ width: '36px', height: '36px', color: 'var(--coral)', flex: 'none' }} />
            <b style={{ fontSize: '19px' }}>Think we got it wrong?</b>
          </div>
          <p className="sm mut" style={{ marginTop: '10px' }}>
            Write to us on {CFG.supportEmail} with the video name, or make the changes and submit it again as a fresh
            submission.
          </p>
        </div>
      </>
    );
  }

  if (st.key === 'needs_info') {
    return (
      <>
        <div className="result" style={{ background: 'var(--blue-pale)', borderColor: 'var(--blue)' }}>
          <Icon name="d-help" style={{ width: '96px', height: '96px', color: 'var(--blue)', flex: 'none' }} />
          <div>
            <h2>One question before we approve.</h2>
            <p className="lead" style={{ marginTop: '8px' }}>
              Answer the reviewer below and this goes straight back in the queue, your place is held.
            </p>
          </div>
        </div>
        <div className="two mt" style={{ gridTemplateColumns: '1.2fr .8fr', alignItems: 'start' }}>
          <Reply sub={sub} onSent={reload} />
          <div className="alert info" style={{ alignItems: 'center' }}>
            <Icon name="d-clock" style={{ color: 'var(--blue)' }} />
            <div>
              <b>Clock is paused.</b>
              <p>The {T.reviewSLA} review clock restarts when you reply.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* approved, published, base paid, bonus paid */
  const basePaid = st.key === 'base_paid' || st.key === 'bonus_paid';
  const bonusPaid = st.key === 'bonus_paid';
  const views = Number(sub.views_30d || 0);
  return (
    <>
      <div className="result" style={{ background: 'var(--yes-tint)' }}>
        {st.key === 'approved' && <Confetti />}
        <Icon name="d-trophy" style={{ width: '110px', height: '110px', color: 'var(--yes)', flex: 'none' }} />
        <div style={{ position: 'relative' }}>
          <h2>{st.key === 'approved' ? 'Approved. Time to publish.' : st.label + '.'}</h2>
          <p className="lead" style={{ marginTop: '8px' }}>
            {st.key === 'approved'
              ? `Publish it on your channel, then add the published link in My videos. ${T.base} lands on ${creator.upi_id || 'your UPI ID'} within ${T.baseDays} of publishing.`
              : `Keep it live. Your bonus is released ${T.bonusDays} after publishing, based on the views it collects.`}
          </p>
        </div>
        {st.key === 'approved' && (
          <Link href="/dashboard" className="btn lg" style={{ marginLeft: 'auto' }}>
            Add published link
          </Link>
        )}
      </div>
      <Track
        steps={[
          { label: 'Submitted', date: fmtShort(sent), state: 'done', icon: 'd-check' },
          { label: 'Approved', date: fmtShort(sub.reviewed_at), state: published ? 'done' : 'now', icon: 'd-star' },
          { label: 'Published', date: published ? fmtShort(published) : '', state: published ? (basePaid ? 'done' : 'now') : 'todo', icon: 'd-play' },
          { label: `Base ${T.base}`, date: published ? `est. ${fmtShort(addDays(published, CFG.basePayDays))}` : '', state: basePaid ? (bonusPaid ? 'done' : 'now') : 'todo', icon: 'd-coin' },
          { label: `Day-${T.day30} bonus`, date: published ? `est. ${fmtShort(addDays(published, CFG.bonusPayDays))}` : '', state: bonusPaid ? 'now' : 'todo', icon: 'd-trophy' },
        ]}
      />
      <div className="two mt" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="card soft">
          <div className="row">
            <Icon name="d-chart" style={{ width: '44px', height: '44px', color: 'var(--coral)', flex: 'none' }} />
            <div>
              <b style={{ fontSize: '20px', display: 'block' }}>Where the bonus stands</b>
              <p className="sm mut">
                {views > 0
                  ? `${views.toLocaleString('en-IN')} views so far, ${slabFor(views).i >= 0 ? 'in the ' + slabFor(views).label + ' slab' : 'bonus starts at ' + T.viewFloorN}`
                  : 'Views are counted once the video is published.'}
              </p>
            </div>
          </div>
          <Ladder active={views > 0 ? slabFor(views).i : -1} />
        </div>
        <div className="stack">
          <div className="alert warn" style={{ alignItems: 'center' }}>
            <Icon name="d-bolt" style={{ color: '#8A6400' }} />
            <div>
              <b>Keep it live {T.day30} days.</b>
              <p>Delete or go private before then and the bonus is void and the account is flagged.</p>
            </div>
          </div>
          <Link href="/dashboard/submit" className="btn lg">
            Submit another
          </Link>
        </div>
      </div>
    </>
  );
}
