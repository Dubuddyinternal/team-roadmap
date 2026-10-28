'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useDash } from '@/components/DashboardShell';
import { getSupabase } from '@/lib/supabase';
import { T } from '@/lib/config';
import { PLATFORMS } from '@/lib/status';

function linkProblem(v, seen) {
  if (!v) return 'Paste the Drive link of your video.';
  if (!/^https?:\/\/\S+\.\S+/.test(v)) {
    return 'That does not look like a link. In Drive: right click the file, Share, anyone with the link, Copy link.';
  }
  if (!/drive\.google\.com|docs\.google\.com/i.test(v)) return 'Please paste a Google Drive link.';
  if (seen.includes(v.toLowerCase())) return 'You already sent us this link. Send a new video instead.';
  return '';
}

export default function SubmitPage() {
  const router = useRouter();
  const { user, submissions, reload } = useDash();
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = link.trim();
    const problem = !title.trim()
      ? 'Give your video a short name so you can find it later.'
      : linkProblem(v, submissions.map((s) => (s.drive_link || '').toLowerCase()));
    if (problem) {
      setErr(problem);
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await getSupabase()
      .from('maverick_submissions')
      .insert({ creator_id: user.id, title: title.trim(), drive_link: v, platform });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await reload();
    router.push('/dashboard');
  }

  return (
    <>
      <h1 style={{ fontSize: 'var(--fs-big)' }}>Submit a video</h1>
      <p className="lead" style={{ marginBottom: '30px' }}>
        A person reviews it in {T.reviewSLA}, then you publish it.
      </p>

      <div className="two">
        <div className="card soft" style={{ padding: '34px' }}>
          <p className="md" style={{ marginBottom: '24px' }}>
            Want to know more?{' '}
            <Link href="/how-it-works" className="linkbtn" style={{ color: 'var(--coral)', fontWeight: 700, textDecoration: 'underline' }}>
              Check How it works
            </Link>
          </p>

          <label className="field">
            <span className="lbl">Video name</span>
            <input className="inp" placeholder="e.g. CUET 2027, my 3 am mock" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="field">
            <span className="lbl">Paste the Drive link of your video</span>
            <input
              className={`inp${err && link ? ' bad' : ''}`}
              placeholder="https://drive.google.com/file/d/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="sm mut" style={{ marginTop: '8px' }}>
              Make sure the link is viewable, so we can open it. In Drive, right click the file, choose Share, set it to
              anyone with the link, then Copy link. Paste only, there is no upload here.
            </p>
          </label>

          <div className="field" style={{ marginTop: '22px' }}>
            <span className="lbl">Select the platform</span>
            <div className="chiprow">
              {PLATFORMS.map((p) => (
                <button key={p.value} className="pick" aria-pressed={platform === p.value} onClick={() => setPlatform(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <p className="errtext">
              <Icon name="d-alert" />
              {err}
            </p>
          )}

          <button className="btn lg" style={{ width: '100%', marginTop: '10px' }} onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Submit for review'}
          </button>
        </div>

        <div className="card" style={{ padding: '34px' }}>
          <div className="row">
            <Icon name="d-flag" style={{ width: '46px', height: '46px', color: 'var(--coral)', flex: 'none' }} />
            <h3 style={{ fontSize: '28px' }}>Process</h3>
          </div>
          <div className="prolist">
            <div className="prostep">
              <span className="n">1</span>
              <div>
                <b>Paste the Drive link of your video.</b>
                <p>Make sure the link is viewable so we can open it.</p>
              </div>
            </div>
            <div className="prostep">
              <span className="n">2</span>
              <div>
                <b>Your video is reviewed and approved within {T.reviewSLA}.</b>
                <p>You get a mail on your sign-up email when it is approved.</p>
              </div>
            </div>
            <div className="prostep">
              <span className="n">3</span>
              <div>
                <b>Once approved, publish your video.</b>
                <p>Then add the published link in My videos, in Overview.</p>
              </div>
            </div>
            <div className="prostep">
              <span className="n">4</span>
              <div>
                <b>Your base pay is released {T.baseDays} after publishing.</b>
                <p>{T.base} for every approved and published video.</p>
              </div>
            </div>
            <div className="prostep">
              <span className="n">5</span>
              <div>
                <b>Your bonus is released {T.bonusDays} after publishing.</b>
                <p>Based on the views your video collects in that window.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
