import Link from 'next/link';
import { CFG } from '@/lib/config';

export default function SiteFooter() {
  return (
    <div className="foot orange">
      <div className="fbrand">
        <svg className="dblogo" viewBox="0 0 164 40" style={{ height: '30px' }}>
          <use href="#dblogo" />
        </svg>
        <p>Maverick by Dubuddy. Get paid for the videos you already make.</p>
      </div>
      <div className="fcols">
        <div className="fcol">
          <b>Maverick</b>
          <Link href="/">Home</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/help">Help</Link>
        </div>
        <div className="fcol">
          <b>Creators</b>
          <Link href="/login">Log in</Link>
          <Link href="/login">Start earning</Link>
          <Link href="/how-it-works">Demo videos</Link>
          <a href={`mailto:${CFG.supportEmail}`}>{CFG.supportEmail}</a>
        </div>
        <div className="fcol">
          <b>Dubuddy</b>
          <a href="https://dubuddy.in">Dubuddy PYQs</a>
          <a href="https://dubuddy.in">Dubuddy Mocks</a>
        </div>
      </div>
      <div className="fbase">
        <span>{'©'} 2026 Dubuddy</span>
        <span>Terms</span>
        <span>Privacy</span>
        <a href={`mailto:${CFG.supportEmail}`}>Contact</a>
        <span style={{ marginLeft: 'auto' }}>Made for CUET students, by people who sat it.</span>
      </div>
    </div>
  );
}
