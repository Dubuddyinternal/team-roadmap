'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import SiteNav from '@/components/SiteNav';
import { getSupabase } from '@/lib/supabase';
import { T } from '@/lib/config';

/* Phone + OTP login through Supabase Auth.
   If your team uses a different OTP provider, only sendCode() and verify() change. */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mob, setMob] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const boxes = useRef([]);

  const phone = '+91' + mob.replace(/\D/g, '');

  /* already signed in: go straight to the dashboard */
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function sendCode() {
    if (mob.replace(/\D/g, '').length !== 10) {
      setErr("That's not 10 digits yet, check and try again.");
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setErr('Login is not connected yet. Please try again soon.');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await sb.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setStep(2);
    setOtp(['', '', '', '', '', '']);
    setLeft(30);
    setTimeout(() => boxes.current[0] && boxes.current[0].focus(), 50);
  }

  async function verify() {
    const token = otp.join('');
    if (token.length !== 6) {
      setErr('Enter all 6 digits.');
      return;
    }
    setBusy(true);
    setErr('');
    const sb = getSupabase();
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      setBusy(false);
      setErr('Wrong code. Check it, or resend a fresh one.');
      return;
    }
    const { data: creator } = await sb.from('maverick_creators').select('id').eq('id', data.user.id).maybeSingle();
    router.replace(creator ? '/dashboard' : '/signup');
  }

  function typeDigit(i, v) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && boxes.current[i + 1]) boxes.current[i + 1].focus();
  }

  return (
    <div className="page rel" style={{ minHeight: '840px' }}>
      <SiteNav />
      <div className="hero" style={{ filter: 'blur(2px)', opacity: 0.5 }} aria-hidden="true">
        <div>
          <h1>Be the real Maverick.</h1>
          <p className="sub">Get paid for the videos you already make.</p>
        </div>
        <div className="rel" style={{ height: '430px' }}>
          <div className="sticker" style={{ position: 'absolute', right: '60px', top: '60px' }}>
            <div>
              <b>{T.base}</b>
              <span>PER VIDEO</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overlay">
        <div className="modal rel">
          <Link href="/" className="x" aria-label="Close">
            {'✕'}
          </Link>
          <div className="side">
            <div>
              <h3>
                Welcome,
                <br />
                Maverick.
              </h3>
              <p className="md" style={{ opacity: 0.85, marginTop: '12px' }}>
                No password. About 20 seconds.
              </p>
              <div className="stack" style={{ gap: '10px', marginTop: '26px', fontSize: '15px', opacity: 0.9 }}>
                <div className="row">
                  <Icon name="d-check" style={{ width: '22px', height: '22px', flex: 'none' }} />
                  Your number is only for the OTP and payout alerts
                </div>
                <div className="row">
                  <Icon name="d-check" style={{ width: '22px', height: '22px', flex: 'none' }} />
                  We never post anything from your account
                </div>
              </div>
            </div>
            <Icon name="d-rocket" className="rocket" style={{ width: '130px', height: '130px', color: '#fff', alignSelf: 'center' }} />
          </div>

          <div className="form">
            {step === 1 ? (
              <div>
                <label className="field">
                  <span className="lbl">Mobile number</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="inp" style={{ width: '84px', textAlign: 'center' }}>
                      +91
                    </div>
                    <input
                      className={`inp tnum${err ? ' bad' : ''}`}
                      maxLength={10}
                      inputMode="numeric"
                      placeholder="98765 43210"
                      value={mob}
                      onChange={(e) => setMob(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                    />
                  </div>
                </label>
                {!err && <p className="helptext">We&apos;ll text you a 6-digit code. Standard SMS rates may apply.</p>}
                {err && (
                  <p className="errtext">
                    <Icon name="d-alert" />
                    {err}
                  </p>
                )}
                <button className="btn" style={{ width: '100%', marginTop: '22px' }} onClick={sendCode} disabled={busy}>
                  {busy ? 'Sending…' : 'Send me the code'}
                </button>
              </div>
            ) : (
              <div>
                <span className="lbl">6 digit OTP</span>
                <div className="otpwrap">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        boxes.current[i] = el;
                      }}
                      className="inp tnum otp"
                      maxLength={1}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      value={d}
                      onChange={(e) => typeDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && boxes.current[i - 1]) boxes.current[i - 1].focus();
                        if (e.key === 'Enter') verify();
                      }}
                    />
                  ))}
                </div>
                <p className="helptext">
                  Sent to <b>+91 {mob}</b> ·{' '}
                  <span
                    className="linkbtn"
                    role="button"
                    style={{ color: 'var(--coral)', fontSize: '14px' }}
                    onClick={() => {
                      setStep(1);
                      setErr('');
                    }}
                  >
                    change number
                  </span>
                </p>
                {err && (
                  <p className="errtext">
                    <Icon name="d-alert" />
                    {err}
                  </p>
                )}
                <div className="row" style={{ margin: '16px 0 22px' }}>
                  <span className="timer">
                    {left > 0 ? (
                      <>
                        Resend in <b>00:{String(left).padStart(2, '0')}</b>
                      </>
                    ) : (
                      "Didn't arrive?"
                    )}
                  </span>
                  <span
                    className="linkbtn"
                    role="button"
                    style={{ marginLeft: 'auto', fontSize: '14px', color: left > 0 ? '#A9A09B' : 'var(--coral)', cursor: left > 0 ? 'default' : 'pointer' }}
                    onClick={() => left <= 0 && sendCode()}
                  >
                    Resend code
                  </span>
                </div>
                <button className="btn" style={{ width: '100%' }} onClick={verify} disabled={busy}>
                  {busy ? 'Checking…' : 'Verify and continue'}
                </button>
              </div>
            )}
            <p className="helptext" style={{ marginTop: '26px' }}>
              The OTP can take up to 30 seconds to arrive on a weak network.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
