import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import usePageMeta from "@/hooks/usePageMeta";
import { RESOURCE_ARTICLES } from "@/content/resources";

export default function Resources() {
  usePageMeta(
    "Resources",
    "Guides on kids' financial literacy: in-game spending, budgeting systems, compound interest, and the psychology behind money habits."
  );

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
                to="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
              >
                Home
              </Link>
              <Link
                to="/faq"
                className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 bg-white px-5 text-base font-extrabold text-sky-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300"
              >
                FAQs
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
          <div className="mx-auto w-full max-w-6xl">
            <div className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                Resources
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
                Guides for raising money-smart kids
              </h1>
              <p className="mt-3 max-w-[65ch] text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                Practical, research-backed reads on in-game spending, budgeting systems, compound interest, and the
                psychology behind why kids (and adults) make the money choices they do.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {RESOURCE_ARTICLES.map((article) => {
                const ArticleIcon = article.icon;
                return (
                  <Link
                    key={article.slug}
                    to={`/resources/${article.slug}`}
                    className="group flex flex-col rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-xl backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl sm:p-7"
                  >
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${article.accent} text-slate-800`}
                    >
                      <ArticleIcon className="h-5 w-5" />
                    </div>

                    <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                      {article.category}
                    </p>
                    <h2 className="mt-1 text-lg font-black leading-snug text-slate-900 sm:text-xl">
                      {article.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm font-semibold leading-relaxed text-slate-600">
                      {article.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-500">
                      <span>{article.readTime}</span>
                      <span className="inline-flex items-center gap-1.5 text-sky-700 transition-transform duration-200 group-hover:translate-x-1">
                        Read article
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/45 bg-white/70 px-4 py-3 text-sm font-bold text-slate-600 backdrop-blur-md sm:px-6">
            <a href="mailto:contact@finntrack.net" className="transition-colors hover:text-sky-700">
              contact@finntrack.net
            </a>
            <Link to="/terms" className="transition-colors hover:text-sky-700">
              Terms & Conditions
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
