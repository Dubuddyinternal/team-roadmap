'use client';

import { useState } from 'react';
import Icon from './Icon';
import { T } from '@/lib/config';

const STEPS = [
  { icon: 'd-person', color: 'var(--coral)', title: 'Sign up', sub: 'About 20 seconds', label: 'About signing up',
    body: 'Mobile number, OTP, then four details: your name, email, YouTube handle and Instagram handle. Nothing to copy, nothing to remember.' },
  { icon: 'd-paper', color: 'var(--ink)', title: 'Read the rulebook', sub: 'Five minutes, once', label: 'About the rulebook',
    body: "It's the Maverick Playbook, right below on this page. Almost every rejection comes from skipping it." },
  { icon: 'd-cam', color: 'var(--blue)', title: 'Film the video', sub: 'Any day, any phone', label: 'About filming',
    body: 'Your phone is enough. Talk about your own prep in your own words, and say Dubuddy out loud while you are at it.' },
  { icon: 'd-link', color: 'var(--ink)', title: 'Upload the Drive link', sub: 'In your dashboard', label: 'About uploading',
    body: 'Put the video file in Google Drive, set it to anyone with the link, then paste that link in your dashboard. Nothing goes public yet.' },
  { icon: 'd-clock', color: 'var(--coral)', title: 'Review and approval', sub: T.reviewSLA, label: 'About approval',
    body: `A person watches it and approves it in ${T.reviewSLA}. Once it is approved, you publish it on your own channel.` },
  { icon: 'd-coin', color: 'var(--yes)', title: 'Get paid', sub: `Base in ${T.baseDays}`, label: 'About getting paid',
    body: `${T.base} base pay is credited within ${T.baseDays} of the publishing date. The bonus is credited within ${T.bonusDays} of the publishing date, based on the views the video picks up in that window.` },
];

export default function StepsTimeline() {
  const [open, setOpen] = useState(-1);
  return (
    <div className="timeline" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
      <svg className="connect ico" viewBox="0 0 1000 40" preserveAspectRatio="none" stroke="var(--coral)" strokeWidth="4" style={{ opacity: 0.45 }}>
        <path d="M10 20C120 2 180 36 290 20s170 16 280 0 180 16 290 0 60 14 130 0" strokeDasharray="14 12" />
      </svg>
      {STEPS.map((s, i) => (
        <div className="tstep" key={s.title}>
          <span className="n">{i + 1}</span>
          <button
            className="infobtn"
            aria-expanded={open === i}
            aria-label={s.label}
            onClick={() => setOpen(open === i ? -1 : i)}
          >
            i
          </button>
          <div className="circle">
            <Icon name={s.icon} style={{ color: s.color }} />
          </div>
          <h4>{s.title}</h4>
          <p>{s.sub}</p>
          {open === i && (
            <div className="infopop">
              <b>Step {i + 1}</b>
              {s.body}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
