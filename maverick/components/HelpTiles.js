'use client';

import { useState } from 'react';
import Icon from './Icon';
import { CFG, T } from '@/lib/config';

const TILES = [
  { icon: 'd-check', color: 'var(--yes)', q: 'How does approval work?',
    a: `When you submit your Drive link, we review your video from our backend panel. It is approved within ${T.reviewSLA}. You get a mail on the email you used at sign-up, telling you the video is approved and that you can publish it. Once you publish, attach the published link in your dashboard and submit it, and we verify it from there. We approve videos based on the points listed in the How it works page, so please go through all of them before making your video. That way your effort is not wasted.` },
  { icon: 'd-flag', color: 'var(--coral)', q: 'What if my video is rejected?',
    a: 'If your video is rejected, we will notify you and share the reason. If you want to work on the changes, go ahead and make them. Then go to Submit a video in your dashboard and submit it again as a fresh submission.' },
  { icon: 'd-clock', color: 'var(--blue)', q: 'My payout is late',
    a: `Mail us on ${CFG.supportEmail} and tell us your payout is late. Attach screenshots of the video details shown in your dashboard.` },
  { icon: 'd-bubble', color: 'var(--ink)', q: 'Any other query?',
    a: `If you have any other query, mail it to us on ${CFG.supportEmail}.` },
];

export default function HelpTiles() {
  const [cur, setCur] = useState(0);
  return (
    <>
      <div className="tiles">
        {TILES.map((t, i) => (
          <button key={t.q} className="tile" aria-expanded={cur === i} onClick={() => setCur(i)}>
            <Icon name={t.icon} style={{ color: t.color }} />
            <h4>{t.q}</h4>
          </button>
        ))}
      </div>
      <div className="answer">{TILES[cur].a}</div>
    </>
  );
}
