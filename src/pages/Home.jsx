import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Coins, Heart, ShieldCheck, Sparkles, Target } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import usePageMeta from "@/hooks/usePageMeta";

const STEPS = [
  {
    number: "1",
    title: "Parents add money",
    text: "Allowance, chores, gifts - all in one place.",
    icon: Coins,
  },
  {
    number: "2",
    title: "Kids log each spend",
    text: "Fast, simple entries with reasons and categories.",
    icon: Target,
  },
  {
    number: "3",
    title: "Everyone learns together",
    text: "Parents get alerts while kids build strong habits.",
    icon: Bell,
  },
];

const VALUE_POINTS = [
  {
    title: "Made for kids",
    text: "Bright visuals, clear language, and confidence-building progress.",
    icon: Sparkles,
    accent: "from-amber-300/70 to-orange-300/70",
  },
  {
    title: "Trusted by parents",
    text: "You stay informed with activity alerts and a complete spending story.",
    icon: ShieldCheck,
    accent: "from-cyan-300/70 to-sky-300/70",
  },
  {
    title: "Healthy money habits",
    text: "Kids learn needs vs wants while setting and reaching money goals.",
    icon: Heart,
    accent: "from-emerald-300/70 to-teal-300/70",
  },
];

export default function Home() {
  usePageMeta(
    null,
    "FinnTrack helps kids track spending and earnings, sort them into needs, wants, assets, and liabilities, and see where their money really goes.",
    "/"
  );

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
    <div className="home-ocean-page min-h-screen text-slate-900">
      <div className="home-ocean-bg" aria-hidden="true" />
      <div className="home-ocean-glow home-ocean-glow-a" aria-hidden="true" />
      <div className="home-ocean-glow home-ocean-glow-b" aria-hidden="true" />

      <div className="relative z-10">
        <header className="w-full px-4 pt-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl border border-white/45 bg-white/70 px-4 py-3 shadow-lg backdrop-blur-md sm:px-6">
            <Link to="/" className="inline-flex items-center gap-2" aria-label="FinnTrack home">
              <FinnLogo className="h-10 w-10" />
              <span className="text-xl font-black tracking-tight text-slate-800">
                Finn<span className="text-amber-500">Track</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                to="/about"
                className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
              >
                About
              </Link>
              <Link
                to="/faq"
                className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
              >
                FAQs
              </Link>
              <Link
                to="/resources"
                className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
              >
                Resources
              </Link>
              <Link
                to="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-6 text-base font-extrabold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-600"
              >
                Login
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 pb-14 pt-7 sm:px-6 lg:px-8">
          <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="landing-title">
            <article className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              <p className="hero-load inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Smart money habits for kids
              </p>

              <h1 id="landing-title" className="mt-4 text-4xl font-black leading-[1.02] tracking-tight text-slate-900 sm:text-5xl">
                <span className="hero-load block" style={{ animationDelay: "80ms" }}>
                  Make every dollar
                </span>
                <span className="hero-load block text-sky-600" style={{ animationDelay: "170ms" }}>
                  a learning moment.
                </span>
              </h1>

              <p className="hero-load mt-4 max-w-[50ch] text-sm font-semibold leading-relaxed text-slate-600 sm:text-base" style={{ animationDelay: "260ms" }}>
                FinnTrack helps kids understand spending, saving, and goals while parents stay informed with real-time updates.
              </p>

              <div className="hero-load mt-6 flex flex-wrap items-center gap-3" style={{ animationDelay: "340ms" }}>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-6 text-base font-extrabold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-600"
                >
                  Get started
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-6 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
                >
                  How it works
                </a>
              </div>
            </article>

            <aside className="home-float rounded-[2rem] border border-white/55 bg-white/75 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              <h2 className="text-lg font-black text-slate-800">This week in your family app</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">A playful snapshot kids love checking.</p>

              <div className="mt-5 space-y-3">
                <div className="home-pop rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-100 to-orange-100 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">Saving streak</p>
                  <p className="mt-1 text-2xl font-black text-amber-900">7 days</p>
                </div>

                <div className="home-pop rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-100 to-cyan-100 p-4" style={{ animationDelay: "160ms" }}>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-sky-700">Goals completed</p>
                  <p className="mt-1 text-2xl font-black text-sky-900">3 this month</p>
                </div>

                <div className="home-pop rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-100 to-teal-100 p-4" style={{ animationDelay: "280ms" }}>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Parent alerts</p>
                  <p className="mt-1 text-2xl font-black text-emerald-900">Always up to date</p>
                </div>
              </div>
            </aside>
          </section>

          <section id="how-it-works" className="mx-auto mt-6 w-full max-w-6xl rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:mt-8 sm:p-8" aria-labelledby="how-title">
            <h2 id="how-title" className="reveal text-2xl font-black text-slate-900 sm:text-3xl" data-reveal>
              How FinnTrack works
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <article
                    key={step.number}
                    className="reveal rounded-2xl border border-sky-100 bg-sky-50/55 p-4"
                    data-reveal
                    style={{ transitionDelay: `${index * 110}ms` }}
                  >
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Step {step.number}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-800">{step.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{step.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mx-auto mt-6 w-full max-w-6xl rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:mt-8 sm:p-8" aria-labelledby="why-title">
            <h2 id="why-title" className="reveal text-2xl font-black text-slate-900 sm:text-3xl" data-reveal>
              Built for kids, designed for parents
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {VALUE_POINTS.map((point, index) => {
                const PointIcon = point.icon;
                return (
                  <article
                    key={point.title}
                    className="reveal rounded-2xl border border-white/70 bg-white p-4 shadow-sm"
                    data-reveal
                    style={{ transitionDelay: `${index * 120}ms` }}
                  >
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${point.accent} text-slate-800`}>
                      <PointIcon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-800">{point.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{point.text}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/45 bg-white/70 px-4 py-3 text-sm font-bold text-slate-600 backdrop-blur-md sm:px-6">
            <a href="mailto:contact@finntrack.net" className="transition-colors hover:text-sky-700">
              contact@finntrack.net
            </a>
            <Link to="/about" className="transition-colors hover:text-sky-700">
              About Us
            </Link>
            <Link to="/terms" className="transition-colors hover:text-sky-700">
              Terms & Conditions
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
