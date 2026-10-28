'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import SiteFooter from '@/components/SiteFooter';
import { getSupabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [f, setF] = useState({ full_name: '', email: '', youtube_handle: '', instagram_handle: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      router.replace('/login');
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
      else setUser(data.session.user);
    });
  }, [router]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const phone = user && user.phone ? '+' + String(user.phone).replace(/^\+/, '') : '';

  async function create() {
    if (!f.full_name.trim()) return setErr('Tell us your name.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('That email does not look right.');
    if (!f.youtube_handle.trim() && !f.instagram_handle.trim()) return setErr('Add your YouTube or Instagram handle.');
    setBusy(true);
    setErr('');
    const { error } = await getSupabase()
      .from('maverick_creators')
      .upsert({
        id: user.id,
        phone,
        full_name: f.full_name.trim(),
        email: f.email.trim(),
        youtube_handle: f.youtube_handle.trim() || null,
        instagram_handle: f.instagram_handle.trim() || null,
      });
    setBusy(false);
    if (error) return setErr(error.message);
    router.push('/how-it-works');
  }

  if (!user) return null;

  return (
    <div className="page">
      <div className="nav">
        <div className="logo">
          <svg className="dblogo" viewBox="0 0 164 40">
            <use href="#dblogo" />
          </svg>
          <b>Maverick</b>
        </div>
        <div className="right">
          <span className="linkbtn">Signed in as {phone}</span>
        </div>
      </div>
      <div className="sec" style={{ paddingTop: '56px' }}>
        <div style={{ maxWidth: '940px', margin: '0 auto' }}>
          <div className="steps">
            <i className="done">{'✓'}</i>
            <span>Number</span>
            <span className="ln2" />
            <i className="on">2</i>
            <span>About you</span>
            <span className="ln2" />
            <i>3</i>
            <span>How it works</span>
          </div>
          <h2>Almost a Maverick.</h2>
          <p className="lead">A few details, then you are in.</p>

          <div className="card mt2" style={{ padding: '40px' }}>
            <div className="formgrid">
              <label className="field">
                <span className="lbl">Mobile number</span>
                <input className="inp tnum" value={phone} readOnly />
              </label>
              <label className="field">
                <span className="lbl">Your name</span>
                <input className="inp" value={f.full_name} onChange={set('full_name')} />
              </label>
              <label className="field">
                <span className="lbl">Email</span>
                <input className="inp" type="email" value={f.email} onChange={set('email')} />
              </label>
              <label className="field">
                <span className="lbl">YouTube handle</span>
                <input className="inp" placeholder="@yourchannel" value={f.youtube_handle} onChange={set('youtube_handle')} />
              </label>
              <label className="field" style={{ marginBottom: '8px' }}>
                <span className="lbl">Instagram handle</span>
                <input className="inp" placeholder="@yourhandle" value={f.instagram_handle} onChange={set('instagram_handle')} />
              </label>
            </div>
            <p className="helptext">Leave one blank if you only post on the other platform.</p>
            {err && (
              <p className="errtext">
                <Icon name="d-alert" />
                {err}
              </p>
            )}
            <button className="btn lg" style={{ width: '100%', marginTop: '20px' }} onClick={create} disabled={busy}>
              {busy ? 'Creating…' : 'Create my account'}
            </button>
          </div>

          <div className="alert info mt2" style={{ alignItems: 'center' }}>
            <Icon name="d-paper" style={{ color: 'var(--blue)' }} />
            <div>
              <b>Next: how it works.</b>
              <p>We walk you through the six steps and the Playbook, then you can open your dashboard from there.</p>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
