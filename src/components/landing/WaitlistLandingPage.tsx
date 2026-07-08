import React from 'react';
import { WaitlistForm } from './WaitlistForm';
import './landing.css';

const PULSE_CHECK_URL = import.meta.env.VITE_PULSE_CHECK_URL ?? '#';

const BrandLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 8.5 7.2 12 12 5.5 16.8 12 21 8.5l-1.8 8.7c-.15.75-.8 1.3-1.57 1.3H6.37c-.77 0-1.42-.55-1.57-1.3L3 8.5Z" />
  </svg>
);

const BrowserFrame: React.FC<{ url: string; imageSrc: string; imageAlt: string }> = ({
  url,
  imageSrc,
  imageAlt,
}) => (
  <div className="frame">
    <div className="chrome">
      <i />
      <i />
      <i />
      <span className="url">{url}</span>
    </div>
    <img src={imageSrc} alt={imageAlt} loading="lazy" />
  </div>
);

interface WaitlistLandingPageProps {
  showDevLogin?: boolean;
  onDevLogin?: () => void;
}

export const WaitlistLandingPage: React.FC<WaitlistLandingPageProps> = ({
  showDevLogin = false,
  onDevLogin,
}) => {
  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      <nav>
        <div className="wrap nav-in">
          <a className="brand" href="#top" aria-label="StrategIQ home">
            <BrandLogo />
            <span>StrategIQ</span>
          </a>
          <div className="nav-cta">
            {PULSE_CHECK_URL !== '#' && (
              <a className="nav-link" href={PULSE_CHECK_URL}>
                Free Brand Pulse Check
              </a>
            )}
            <button type="button" className="btn small" onClick={scrollToWaitlist}>
              Join the waitlist
            </button>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap">
          <div className="eyebrow">FOR SHOPIFY CLOTHING BRANDS</div>
          <h1>
            Know your customers.
            <br />
            Know what to do <span className="nx">next.</span>
          </h1>
          <p className="lede">
            StrategIQ reads your Shopify order data and turns it into plain-English answers: who your
            best customers are, who is about to churn, and the single most useful thing you can do
            about it this week.
          </p>

          <WaitlistForm inputId="waitlist-email-hero" variant="default" />

          <BrowserFrame
            url="strategiq.website"
            imageSrc="/landing/dashboard.png"
            imageAlt="StrategIQ dashboard showing revenue at risk, customer segments, and revenue forecast"
          />
        </div>
      </header>

      <section className="band">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">THE PROBLEM</div>
            <h2>Shopify shows you what sold. It can&apos;t tell you what to do next.</h2>
          </div>
          <div className="grid3">
            <div className="pcard">
              <div className="lab">GUT-FEEL MARKETING</div>
              <p>
                Most campaign decisions get made on instinct, because the answers are scattered
                across Shopify, Klaviyo, Meta and a spreadsheet somewhere.
              </p>
            </div>
            <div className="pcard">
              <div className="lab">INVISIBLE CHURN</div>
              <p>
                Customers quietly stop buying, and nothing flags it until the revenue dip shows up
                weeks later.
              </p>
            </div>
            <div className="pcard">
              <div className="lab">DISCOUNT GUESSWORK</div>
              <p>
                Sales shift stock, but you can&apos;t see whether they bring back full-price customers
                or train people to wait for 20% off.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">HOW IT WORKS</div>
            <h2>From CSV to clear next move in minutes</h2>
          </div>
          <div className="steps">
            <div className="step">
              <div className="num">01</div>
              <h3>Upload your Shopify export</h3>
              <p>
                Drop in the order CSV. Columns are mapped automatically, so there&apos;s no
                formatting or setup to fight with.
              </p>
            </div>
            <div className="step">
              <div className="num">02</div>
              <h3>The data science runs for you</h3>
              <p>
                Every customer gets scored: RFM segment, churn risk, lifetime value and product
                behaviour, all explained in plain English.
              </p>
            </div>
            <div className="step">
              <div className="num">03</div>
              <h3>Get your move for the week</h3>
              <p>
                One prioritised action with the revenue behind it. Do it, see the result, come back
                next week for the next one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">WHAT&apos;S INSIDE</div>
            <h2>A data team&apos;s output, without the data team</h2>
          </div>
          <div className="fgrid">
            <div className="fcard">
              <h3>Nine customer segments</h3>
              <p>
                From Champions to Hibernating, each with its size, revenue contribution and a
                recommended action.
              </p>
            </div>
            <div className="fcard">
              <h3>Churn prediction</h3>
              <p>
                See who&apos;s likely to lapse before it happens, with the £ value at risk attached
                to every name.
              </p>
            </div>
            <div className="fcard">
              <h3>Revenue forecasting</h3>
              <p>
                Actual against predicted, so peak seasons and slow patches never take you by
                surprise.
              </p>
            </div>
            <div className="fcard">
              <h3>Discount analysis</h3>
              <p>
                Learn whether discounted first orders turn into loyal customers or one-time bargain
                hunters.
              </p>
            </div>
            <div className="fcard">
              <h3>Product performance</h3>
              <p>
                Top sellers, the products that drive repeat purchases, and the one-purchase wonders
                that don&apos;t.
              </p>
            </div>
            <div className="fcard">
              <h3>Plain English throughout</h3>
              <p>
                Every metric has a tooltip and a glossary entry. Built for brand owners, not
                analysts.
              </p>
            </div>
          </div>

          <div className="caption">
            <div className="eyebrow">YOUR WEEKLY PLAYBOOK</div>
          </div>
          <div className="frame-stack">
            <BrowserFrame
              url="strategiq.website/dashboard"
              imageSrc="/landing/customer-actions.png"
              imageAlt="StrategIQ weekly customer actions ranked by priority and revenue at stake"
            />
            <BrowserFrame
              url="strategiq.website/dashboard"
              imageSrc="/landing/ai-insights.png"
              imageAlt="StrategIQ AI-powered insights with actionable recommendations"
            />
          </div>
        </div>
      </section>

      <section className="cta" id="waitlist">
        <div className="wrap">
          <h2>Be first in line</h2>
          <p>
            Early access opens to the waitlist first, and early members help shape what gets built.
            Solo-founded, built in public.
          </p>
          <WaitlistForm inputId="waitlist-email-cta" variant="cta" />
        </div>
      </section>

      <footer>
        <div className="wrap">
          <a className="brand" href="#top" aria-label="Back to top">
            <BrandLogo />
            <span>StrategIQ</span>
          </a>
          <div className="tag">KNOW YOUR CUSTOMERS · KNOW WHAT TO DO NEXT</div>
          <div className="fine">
            Built in public by a solo founder
            {PULSE_CHECK_URL !== '#' && (
              <>
                {' '}
                ·{' '}
                <a href={PULSE_CHECK_URL}>Try the free Brand Pulse Check</a>
              </>
            )}{' '}
            · © 2026 StrategIQ
          </div>
          {showDevLogin && onDevLogin && (
            <div className="dev-login">
              <button type="button" onClick={onDevLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit', textDecoration: 'underline' }}>
                Developer login
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
