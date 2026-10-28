'use client';

import { useState } from 'react';
import Icon from './Icon';
import Ladder from './Ladder';
import { CFG, T, money, slabFor } from '@/lib/config';

const COINS = Array.from({ length: 14 }, (_, i) => ({
  cx: i % 2 === 0 ? 42 : 258,
  cy: 276 - Math.floor(i / 2) * 30,
}));

function Arrow({ style }) {
  return (
    <svg viewBox="0 0 58 26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M3 13h46" />
      <path d="M40 5l9 8-9 8" />
    </svg>
  );
}

export default function Calculator() {
  const [vids, setVids] = useState(5);
  const [views, setViews] = useState(10000);
  const [touched, setTouched] = useState(false);

  const sl = slabFor(views);
  const ok = views >= CFG.viewFloor;
  const basePay = vids * CFG.base;
  const viewBonus = ok ? vids * sl.bonus : 0;
  const total = basePay + viewBonus;
  const lit = Math.max(0, Math.min(COINS.length, Math.round(total / 450)));

  return (
    <div className="earnbody">
      <div className="earnrow">
        <div className="calc" style={{ gridTemplateColumns: '1fr' }}>
          <div className="in">
            <div className="sl compact">
              <div className="top">
                <b>{vids} videos</b>
                <span className="mut sm">approved this month</span>
              </div>
              <input
                type="range" min="1" max="20" step="1" value={vids}
                aria-label="Approved videos this month"
                onChange={(e) => { setTouched(true); setVids(+e.target.value); }}
              />
              <div className="ends"><span>1</span><span>20</span></div>
            </div>
            <div className="slidehint">
              <Arrow />
              <span className="hand">slide this one too</span>
            </div>
            <div className="sl compact" style={{ marginBottom: '6px' }}>
              <div className="top">
                <b>{views >= 30000 ? '30,000+' : views.toLocaleString('en-IN')} views</b>
                <span className="mut sm">average per video</span>
              </div>
              <input
                type="range" min="500" max="30000" step="500" value={views}
                aria-label="Average views per video"
                onChange={(e) => { setTouched(true); setViews(+e.target.value); }}
              />
              <div className="ends"><span>500</span><span>30,000+</span></div>
            </div>
            <p className="sm mut">
              Base pay lands on every approved and published video. The bonus starts once it crosses {T.viewFloorN} views.
            </p>
          </div>
          <div className="out" style={{ borderRadius: '0 0 var(--r) var(--r)' }}>
            <span className="sm" style={{ color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Your month
            </span>
            <div className="orow">
              <span>
                Base pay<br />
                <em style={{ fontStyle: 'normal', fontSize: '13px', color: 'rgba(255,255,255,.45)' }}>
                  {vids} {'×'} {money(CFG.base)}, paid whatever the views do
                </em>
              </span>
              <b>{money(basePay)}</b>
            </div>
            <div className="orow">
              <span>
                View bonus<br />
                <em style={{ fontStyle: 'normal', fontSize: '13px', color: 'rgba(255,255,255,.45)' }}>
                  {ok
                    ? `${vids} × ${money(sl.bonus)}, ${sl.label} views`
                    : `Bonus starts at ${CFG.viewFloor.toLocaleString('en-IN')} views`}
                </em>
              </span>
              <b>{money(viewBonus)}</b>
            </div>
            <div className="orow total">
              <span>Monthly total</span>
              <b>{money(total)}</b>
            </div>
          </div>
        </div>

        {/* coins stack up as you slide */}
        <div className="earnart">
          <svg viewBox="0 0 300 330" style={{ width: '100%', maxWidth: '560px', height: '500px' }} aria-hidden="true">
            <g>
              {COINS.map((c, i) => {
                const on = i < lit;
                return (
                  <g key={i} transform={`translate(${c.cx},${c.cy})`}>
                    <g
                      className="coin"
                      opacity={on ? 1 : 0}
                      style={{
                        transform: on ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.82)',
                        transitionDelay: (on ? Math.min(i, 9) * 25 : 0) + 'ms',
                      }}
                    >
                      <ellipse rx="30" ry="12" fill="#FFC53D" stroke="#0F0F0F" strokeWidth="4" />
                      <text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0F0F0F" style={{ fontFamily: 'var(--f)' }}>
                        {'₹'}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
            <g transform="translate(96,130)">
              <circle cx="54" cy="40" r="27" fill="#FFE0D4" stroke="#0F0F0F" strokeWidth="5" />
              <path d="M27 156c0-29 12-46 27-46s27 18 27 46z" fill="#F1684C" stroke="#0F0F0F" strokeWidth="5" strokeLinejoin="round" />
              <path d="M35 120l-22 17M73 120l24 16" className="ico" stroke="#0F0F0F" strokeWidth="5" />
              <g className="ico" stroke="#0F0F0F" strokeWidth="5">
                <path d="M45 37l5 5M63 37l5 5M46 52c5 5 13 5 18 0" />
              </g>
            </g>
            <g className="ico" stroke="#F1684C" strokeWidth="5" opacity={sl.i === CFG.slabs.length - 1 ? 1 : 0}>
              <path d="M118 112l-11-15M150 100v-17M182 112l11-15" />
            </g>
            <text x="150" y="318" textAnchor="middle" className="hand" fontSize="21" fill="#F1684C">
              {money(total)} this month
            </text>
          </svg>
        </div>
      </div>

      {/* slabs, directly below the calculator */}
      <div className="slabwrap">
        <h3 style={{ fontSize: '30px' }}>What each video pays</h3>
        <p className="lead" style={{ fontSize: '19px', marginTop: '8px' }}>
          Base pay lands within {T.baseDays} of publishing. The bonus is counted on views over the first {T.day30} days and
          released within {T.bonusDays} of publishing.
        </p>
        <Ladder
          active={touched ? sl.i : -1}
          onPick={(min) => {
            setTouched(true);
            setViews(Math.max(500, Math.min(30000, min)));
          }}
        />
        <div className="organic">
          <Icon name="d-shield" />
          <span>Views must be organic. Videos should not be promoted or boosted to get views.</span>
        </div>
        <div className="slidehint slabhint">
          <Arrow style={{ color: 'var(--coral)' }} />
          <span className="hand">tap any row to drop it into the calculator</span>
        </div>
      </div>
    </div>
  );
}
