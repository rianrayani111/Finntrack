import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const HOW_STEPS = [
  {
    number: '01',
    title: 'You add money',
    text: 'Allowance, birthday cash, chores.',
  },
  {
    number: '02',
    title: 'They spend it',
    text: 'Then log what it was for.',
  },
  {
    number: '03',
    title: 'They see the pattern',
    text: "Where it went, and what's left.",
  },
];

const CATEGORIES = [
  {
    name: 'NECESSITY',
    gloss: 'things you need',
    amount: '$2.50',
  },
  {
    name: 'WANT',
    gloss: "things you'd like",
    amount: '$4.00',
  },
  {
    name: 'ASSET',
    gloss: 'money that grows',
    amount: '$3.00',
  },
  {
    name: 'LIABILITY',
    gloss: 'money you owe',
    amount: '$1.00',
  },
];

const NO_ITEMS = ['No debit card', 'No bank account', 'No advertising', 'No tracking'];

function StepIcon({ index }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="ledger-icon">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <line x1="7" y1="10" x2="17" y2="10" />
        <line x1="7" y1="14" x2="13" y2="14" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="ledger-icon">
        <circle cx="12" cy="12" r="8.5" />
        <line x1="12" y1="7.5" x2="12" y2="16.5" />
        <line x1="8.5" y1="10" x2="15.5" y2="10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ledger-icon">
      <path d="M4 17.5V6.5" />
      <path d="M9 17.5V10.5" />
      <path d="M14 17.5V8.5" />
      <path d="M19 17.5V4.5" />
      <line x1="3" y1="17.5" x2="21" y2="17.5" />
    </svg>
  );
}

export default function Home() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="ledger-page">
      <header className="ledger-topbar">
        <p className="ledger-brand">FinnTrack</p>
        <Link className="ledger-login-link" to="/login">
          Login
        </Link>
      </header>

      <main>
        <section className="ledger-hero ledger-ruled" aria-labelledby="landing-title">
          <div className="ledger-shell ledger-hero-grid">
            <div>
              <h1 id="landing-title" className="ledger-hero-title">
                <span className="hero-load" style={{ animationDelay: '0ms' }}>
                  Ten dollars on Monday. Gone by Friday.
                </span>
                <span className="ledger-red hero-load" style={{ animationDelay: '120ms' }}>
                  Now they&apos;ll know where it went.
                </span>
              </h1>

              <p className="ledger-subhead hero-load" style={{ animationDelay: '220ms' }}>
                FinnTrack teaches kids 6-10 to track their own cash. No debit card needed.
              </p>

              <div className="ledger-hero-actions hero-load" style={{ animationDelay: '320ms' }}>
                <Link to="/login" className="ledger-btn-primary">
                  Get started
                </Link>
                <a href="#how-it-works" className="ledger-text-link">
                  See how it works
                </a>
              </div>
            </div>

            <figure className="ledger-figure">
              {/* Photo slot: child at a kitchen table with a few dollar bills and a tablet. */}
              <div
                className="ledger-image-slot ledger-image-portrait"
                role="img"
                aria-label="Photo placeholder: child at a kitchen table with dollar bills and a tablet."
              >
                <span>Hero photo slot</span>
              </div>
            </figure>
          </div>
        </section>

        <section className="ledger-dark" aria-labelledby="problem-title">
          <div className="ledger-shell">
            <h2 id="problem-title" className="ledger-section-title reveal" data-reveal>
              Cash leaves no trace.
            </h2>
            <p className="ledger-dark-copy reveal" data-reveal style={{ transitionDelay: '100ms' }}>
              A five dollar bill becomes a snack, a toy, and a memory nobody kept.
            </p>
            <p className="ledger-dark-copy reveal" data-reveal style={{ transitionDelay: '180ms' }}>
              Card-based apps can&apos;t see any of it.
            </p>

            <div className="ledger-coins reveal" data-reveal style={{ transitionDelay: '240ms' }} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="ledger-ruled" aria-labelledby="how-title">
          <div className="ledger-shell">
            <h2 id="how-title" className="ledger-heading reveal" data-reveal>
              How it works
            </h2>
            <div className="ledger-steps">
              {HOW_STEPS.map((step, index) => (
                <article
                  key={step.number}
                  className="ledger-step-card reveal"
                  data-reveal
                  style={{ transitionDelay: `${index * 110}ms` }}
                >
                  <StepIcon index={index} />
                  <p className="ledger-step-number">{step.number}</p>
                  <h3 className="ledger-step-title">{step.title}</h3>
                  <p className="ledger-step-text">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ledger-ruled ledger-categories" aria-labelledby="categories-title">
          <div className="ledger-shell">
            <h2 id="categories-title" className="ledger-heading reveal" data-reveal>
              The four categories
            </h2>

            <div className="ledger-write-list">
              {CATEGORIES.map((item, index) => (
                <article
                  key={item.name}
                  className="ledger-write-row reveal"
                  data-reveal
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  <h3 className="ledger-category-name">{item.name}</h3>
                  <p className="ledger-category-gloss">{item.gloss}</p>
                  <p className="ledger-amount" style={{ transitionDelay: `${index * 150 + 80}ms` }}>
                    {item.amount}
                  </p>
                </article>
              ))}
            </div>

            <p className="ledger-categories-line reveal" data-reveal style={{ transitionDelay: '240ms' }}>
              The same four words every balance sheet runs on.
            </p>
          </div>
        </section>

        <section className="ledger-ruled" aria-labelledby="parents-title">
          <div className="ledger-shell ledger-parent-grid">
            <div>
              <h2 id="parents-title" className="ledger-heading reveal" data-reveal>
                You see everything.
              </h2>

              <ul className="ledger-parent-points">
                <li className="reveal" data-reveal style={{ transitionDelay: '60ms' }}>
                  Every entry, as it happens
                </li>
                <li className="reveal" data-reveal style={{ transitionDelay: '140ms' }}>
                  An alert each time they spend - amount, time, place, and reason
                </li>
                <li className="reveal" data-reveal style={{ transitionDelay: '220ms' }}>
                  You add the money. Only they spend it.
                </li>
              </ul>
            </div>

            <figure className="ledger-figure">
              {/* Photo slot: parent looking at a phone in a warm domestic setting. */}
              <div
                className="ledger-image-slot ledger-image-landscape"
                role="img"
                aria-label="Photo placeholder: parent looking at a phone in a warm domestic setting."
              >
                <span>Parent photo slot</span>
              </div>
            </figure>
          </div>
        </section>

        <section className="ledger-dark" aria-labelledby="dont-title">
          <div className="ledger-shell">
            <h2 id="dont-title" className="ledger-heading ledger-paper reveal" data-reveal>
              What we don&apos;t do
            </h2>

            <div className="ledger-no-grid">
              {NO_ITEMS.map((item, index) => (
                <p key={item} className="reveal" data-reveal style={{ transitionDelay: `${index * 90}ms` }}>
                  {item}
                </p>
              ))}
            </div>

            <p className="ledger-dark-footnote reveal" data-reveal style={{ transitionDelay: '180ms' }}>
              Funded by subscription. Never by data.
            </p>
          </div>
        </section>

        <section className="ledger-ruled" aria-labelledby="pricing-title">
          <div className="ledger-shell ledger-pricing">
            <h2 id="pricing-title" className="ledger-heading reveal" data-reveal>
              Pricing
            </h2>

            <div className="ledger-pricing-pair">
              <p className="ledger-price reveal" data-reveal style={{ transitionDelay: '80ms' }}>
                $6.99 / month
              </p>
              <p className="ledger-price ledger-price-focus reveal" data-reveal style={{ transitionDelay: '160ms' }}>
                $49.99 / year
              </p>
            </div>

            <p className="ledger-pricing-note reveal" data-reveal style={{ transitionDelay: '220ms' }}>
              One subscription covers every child. Full refund within 14 days.
            </p>

            <Link to="/login" className="ledger-btn-primary reveal" data-reveal style={{ transitionDelay: '280ms' }}>
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="ledger-footer">
        <div className="ledger-shell ledger-footer-inner">
          <a href="mailto:contact@finntrack.net" className="ledger-footer-link">
            contact@finntrack.net
          </a>
          <Link to="/terms" className="ledger-footer-link">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
