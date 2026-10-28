import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import Calculator from '@/components/Calculator';
import { T } from '@/lib/config';

export default function HomePage() {
  return (
    <div className="page">
      <SiteNav />
      <div className="hero">
        <div className="rel">
          <h1>
            Be the real{" "}
            <span className="mark">
              Maverick.
              <svg viewBox="0 0 300 100" className="ico" style={{ color: "var(--coral)", strokeWidth: "5" }}>
                <path d="M286 44c-6-20-60-34-136-34S12 24 10 48s56 42 134 44 148-20 142-48c-3-14-26-24-50-29" />
              </svg>
            </span>
          </h1>
          <p className="sub">
            Get paid for the videos you already make.
          </p>
          <div className="trust" style={{ marginTop: "26px" }}>
            <svg className="ico thin" style={{ width: "26px", height: "26px", color: "var(--yes)" }} viewBox="0 0 100 100">
              <use href="#d-check" />
            </svg>
            2 Lakh+ students practice on Dubuddy
          </div>
          <p className="hand" style={{ fontSize: "21px", color: "var(--coral)", transform: "rotate(-3deg)", display: "inline-block", marginTop: "16px" }}>
            <span>{T.base}</span>
            {" "}a video, and more when it travels
          </p>
          <div className="acts" style={{ marginTop: "22px" }}>
            <Link href="/login" className="btn lg">
              Start earning
            </Link>
            <Link href="/how-it-works" className="linkbtn" style={{ color: "var(--coral)" }}>
              See how it works →
            </Link>
          </div>
        </div>
        <div className="rel" style={{ height: "430px" }}>
          <svg viewBox="0 0 560 430" className="doodle" style={{ height: "430px" }}>
            <g className="ico" stroke="#D9D3CE" strokeWidth="5" opacity=".85">
              <g transform="translate(40,96) scale(.78)">
                <use href="#g-person" />
              </g>
              <g transform="translate(140,76) scale(.78)">
                <use href="#g-person" />
              </g>
              <g transform="translate(240,86) scale(.78)">
                <use href="#g-person" />
              </g>
              <g transform="translate(340,74) scale(.78)">
                <use href="#g-person" />
              </g>
              <g transform="translate(440,92) scale(.78)">
                <use href="#g-person" />
              </g>
              <g transform="translate(90,34) scale(.6)">
                <use href="#g-person" />
              </g>
              <g transform="translate(300,28) scale(.6)">
                <use href="#g-person" />
              </g>
              <g transform="translate(400,24) scale(.6)">
                <use href="#g-person" />
              </g>
            </g>
            <g transform="translate(196,150)">
              <circle cx="68" cy="52" r="34" fill="#FFE0D4" stroke="#0F0F0F" strokeWidth="5" />
              <path d="M34 196c0-36 16-58 34-58s34 22 34 58z" fill="#F1684C" stroke="#0F0F0F" strokeWidth="5" strokeLinejoin="round" />
              <path d="M44 150l-28 22M92 150l30 20" className="ico" stroke="#0F0F0F" strokeWidth="5" />
              <rect x="112" y="150" width="34" height="52" rx="7" fill="#3599FF" stroke="#0F0F0F" strokeWidth="5" />
              <circle cx="129" cy="162" r="4" fill="#0F0F0F" />
              <g className="ico" stroke="#0F0F0F" strokeWidth="5">
                <path d="M56 48l6 6M80 48l6 6M58 68c6 6 16 6 22 0" />
              </g>
              <g transform="translate(34,-24) scale(.44)" className="ico" stroke="#0F0F0F" strokeWidth="10" fill="#FFC53D">
                <use href="#g-crown" />
              </g>
            </g>
            <g className="ico" stroke="#F1684C" strokeWidth="5">
              <g transform="translate(416,180) scale(.5)">
                <use href="#g-star" />
              </g>
              <g transform="translate(84,212) scale(.42)">
                <use href="#g-bolt" />
              </g>
              <path d="M470 118l16-10M478 146l20-2" />
            </g>
            <path d="M30 392c110-16 180 10 260-4s150-18 236 2" className="ico" stroke="#0F0F0F" strokeWidth="5" />
            <text x="300" y="424" className="hand" fontSize="22" fill="#8A7F7A">
              everyone else
            </text>
            <text x="120" y="424" className="hand" fontSize="22" fill="#F1684C">
              you
            </text>
          </svg>
          <div className="sticker" style={{ position: "absolute", right: "6px", top: "-6px" }}>
            <div>
              <b>{T.base}</b>
              <span>
                PER VIDEO
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="strip">
        <div>
          <svg className="ico ic" viewBox="0 0 100 100">
            <use href="#d-film" />
          </svg>
          <div>
            <b>
              Film it
            </b>
            <span>
              Any day, any phone
            </span>
          </div>
        </div>
        <div>
          <svg className="ico ic" viewBox="0 0 100 100">
            <use href="#d-send" />
          </svg>
          <div>
            <b>
              Submit it
            </b>
            <span>
              Paste one link
            </span>
          </div>
        </div>
        <div>
          <svg className="ico ic" viewBox="0 0 100 100">
            <use href="#d-coin" />
          </svg>
          <div>
            <b>
              Get paid
            </b>
            <span>
              Straight to UPI
            </span>
          </div>
        </div>
      </div>
      <div className="flow right" id="pickSec">
        <div className="flowart" aria-hidden="true">
          <svg viewBox="0 0 400 400">
            <g className="ico" style={{ stroke: "#E6DED6" }} stroke="#E6DED6" strokeWidth="7" fill="none">
              <g transform="translate(40,60) scale(2.1)">
                <use href="#g-cam" />
              </g>
            </g>
            <g className="ico" style={{ stroke: "#F1684C" }} stroke="#F1684C" strokeWidth="7" fill="none" opacity=".4">
              <g transform="translate(236,214) scale(1.5)">
                <use href="#g-help" />
              </g>
            </g>
            <g className="ico" style={{ stroke: "#3599FF" }} stroke="#3599FF" strokeWidth="7" fill="none" opacity=".35">
              <g transform="translate(46,268) scale(1.1)">
                <use href="#g-person" />
              </g>
            </g>
            <path d="M172 330c40 18 92 16 140-6" className="ico" style={{ stroke: "#E6DED6" }} stroke="#E6DED6" strokeWidth="7" fill="none" />
          </svg>
        </div>
        <div className="wrap">
          <div className="flowhead">
            <span className="flowstep">
              <i>
                1
              </i>
              first, tell us about you
            </span>
            <h2>
              Which one are you?
            </h2>
            <p className="lead">
              Either one is fine. Both take you to the same page, where we show you exactly what to film.
            </p>
          </div>
          <div className="paths" id="paths">
            <Link href="/how-it-works" className="path" data-pick="creator">
              <span className="pickmark">
                Pick this
              </span>
              <span className="pnum">
                Path 1
              </span>
              <svg className="d ico" style={{ width: "150px", height: "150px", right: "-30px", bottom: "-26px", color: "var(--coral)", opacity: ".16" }} viewBox="0 0 100 100">
                <use href="#d-film" />
              </svg>
              <svg className="ico pico" viewBox="0 0 100 100" style={{ color: "var(--coral)" }}>
                <use href="#d-film" />
              </svg>
              <h3>
                I already make videos
              </h3>
              <p className="plead">
                Then this is just extra money on what you already post. Same videos, two extra mentions.
              </p>
              <div className="chips">
                <span className="chip">
                  CUET creators
                </span>
                <span className="chip">
                  Class 12 creators
                </span>
                <span className="chip">
                  Study vloggers
                </span>
                <span className="chip">
                  College life creators
                </span>
                <span className="chip">
                  Strategy videos (CUET, Class 12, boards)
                </span>
                <span className="chip">
                  Any other
                </span>
              </div>
            </Link>
            <Link href="/how-it-works" className="path" data-pick="new">
              <span className="pickmark">
                Pick this
              </span>
              <span className="pnum" style={{ background: "var(--blue)" }}>
                Path 2
              </span>
              <svg className="d ico" style={{ width: "150px", height: "150px", right: "-30px", bottom: "-26px", color: "var(--blue)", opacity: ".16" }} viewBox="0 0 100 100">
                <use href="#d-cam" />
              </svg>
              <svg className="ico pico" viewBox="0 0 100 100" style={{ color: "var(--blue)" }}>
                <use href="#d-cam" />
              </svg>
              <h3>
                I've never made a video
              </h3>
              <p className="plead">
                Most people film their first one in a single take. No editing, no face, about 40 seconds.
              </p>
              <div className="pnote">
                <svg className="ico" viewBox="0 0 100 100">
                  <use href="#d-check" />
                </svg>
                <div>
                  <b>
                    No minimum follower requirement.
                  </b>
                  {" "}The only must: your Instagram or YouTube account should be public, since your videos will be published there.
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
      <div className="flow left wide" id="earnSec">
        <div className="wrap">
          <div className="flowhead">
            <span className="flowstep">
              <i>
                2
              </i>
              now the money
            </span>
            <h2>
              What you'll earn in a month
            </h2>
            <p className="lead" id="earnIntro">
              Slide it to the number of videos you would actually post. The total is what lands in your UPI.
            </p>
          </div>
          <Calculator />
        </div>
      </div>
      <div className="endcta">
        <div className="wrap">
          <svg className="dblogo lg2" viewBox="0 0 164 40">
            <use href="#dblogo" />
          </svg>
          <h2>
            Start earning.
          </h2>
          <p className="lead">
            One video, one link, and the first{" "}
            <span>{T.base}</span>
            {" "}is on its way.
          </p>
          <Link href="/login" className="btn lg">
            Start earning
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
