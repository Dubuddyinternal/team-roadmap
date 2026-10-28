import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import HelpTiles from '@/components/HelpTiles';
import { T } from '@/lib/config';

export const metadata = { title: 'Help · Maverick by Dubuddy' };

export default function HelpPage() {
  return (
    <div className="page">
      <SiteNav />
      <div className="sec">
        <h2>
          Stuck? Start here.
        </h2>
        <p className="lead">
          Tap a tile. Everything else is one email away.
        </p>
        <HelpTiles />
        <div className="card mt2 statusbox">
          <div className="row">
            <svg className="ico" viewBox="0 0 100 100" style={{ width: "44px", height: "44px", color: "var(--blue)", flex: "none" }}>
              <use href="#d-flag" />
            </svg>
            <div>
              <h3 style={{ fontSize: "24px" }}>
                What each status means
              </h3>
              <p className="sm mut" style={{ marginTop: "4px" }}>
                Every video in My videos sits at one of these six. It moves on its own, you do not have to ask us.
              </p>
            </div>
          </div>
          <div className="mt">
            <div className="srow">
              <span className="badge rev">
                Under review
              </span>
              <p>
                Your Drive link is with us. A person watches the video and decides within{" "}
                <span>{T.reviewSLA}</span>
                .
              </p>
            </div>
            <div className="srow">
              <span className="badge app">
                Approved, ready to publish
              </span>
              <p>
                Your video is approved. Publish it on your channel, then click the status in My videos and add your published link and channel link.
              </p>
            </div>
            <div className="srow">
              <span className="badge rej">
                Rejected
              </span>
              <p>
                We could not approve it. The reason sits on the info button next to the status. Make the changes if you want to, then submit it again as a fresh submission.
              </p>
            </div>
            <div className="srow">
              <span className="badge paid">
                Published
              </span>
              <p>
                Your video has been published and is now under verification. After{" "}
                <span>{T.baseDays}</span>
                , your payout is released.
              </p>
            </div>
            <div className="srow">
              <span className="badge app">
                Base pay released
              </span>
              <p>
                <span>{T.base}</span>
                {" "}has been sent to the UPI ID saved in Payouts.
              </p>
            </div>
            <div className="srow">
              <span className="badge app">
                Bonus released
              </span>
              <p>
                <span>{T.bonusDays}</span>
                {" "}after publishing we count the views your video collected and release your bonus. The status changes on its own.
              </p>
            </div>
          </div>
        </div>
        <div className="card mt2">
          <div className="row">
            <svg className="ico" viewBox="0 0 100 100" style={{ width: "44px", height: "44px", color: "var(--coral)", flex: "none" }}>
              <use href="#d-bubble" />
            </svg>
            <h3 style={{ fontSize: "24px" }}>
              Talk to a human
            </h3>
          </div>
          <div className="two mt" style={{ gridTemplateColumns: "1fr 1fr", gap: "18px", alignItems: "stretch" }}>
            <div className="row" style={{ background: "var(--tint)", borderRadius: "16px", padding: "18px 20px", height: "100%" }}>
              <span className="lbl" style={{ margin: "0", minWidth: "92px" }}>
                Email
              </span>
              <span className="md" style={{ fontWeight: "600" }}>
                support@dubuddy.in{" "}
                <span className="tag ph">
                  email to confirm
                </span>
              </span>
            </div>
            <div className="row" style={{ background: "var(--tint)", borderRadius: "16px", padding: "18px 20px", height: "100%" }}>
              <span className="lbl" style={{ margin: "0", minWidth: "92px" }}>
                Reply by
              </span>
              <span className="md" style={{ fontWeight: "600" }}>
                Within{" "}
                <span>{T.supportSLA}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
