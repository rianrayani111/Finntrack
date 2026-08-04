import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import FinnLogo from "@/components/FinnLogo";
import usePageMeta from "@/hooks/usePageMeta";
import { getResourceBySlug } from "@/content/resources";

function ArticleBlock({ block, index }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={index} className="mt-8 text-xl font-black text-slate-900 sm:text-2xl">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={index} className="mt-6 text-lg font-extrabold text-slate-800">
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p key={index} className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
          {block.text}
        </p>
      );
    case "quote":
      return (
        <blockquote
          key={index}
          className="mt-4 rounded-2xl border-l-4 border-sky-400 bg-sky-50/70 px-4 py-3 text-sm font-bold italic leading-relaxed text-slate-700 sm:text-base"
        >
          "{block.text}"
        </blockquote>
      );
    case "callout":
      return (
        <div key={index} className="mt-4 rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 sm:p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-sky-700">{block.title}</p>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">{block.text}</p>
        </div>
      );
    case "fact":
      return (
        <p key={index} className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
          <span className="font-extrabold text-slate-800">{block.label}</span> {block.text}
        </p>
      );
    case "ul":
      return (
        <ul key={index} className="mt-4 space-y-3">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-3 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-sky-400" />
              <span>
                {item.label && <span className="font-extrabold text-slate-800">{item.label} </span>}
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export default function ResourceArticle() {
  const { slug } = useParams();
  const article = getResourceBySlug(slug);

  usePageMeta(article?.title, article?.description);

  if (!article) {
    return <Navigate to="/resources" replace />;
  }

  const ArticleIcon = article.icon;

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
          <div className="mx-auto w-full max-w-3xl">
            <Link
              to="/resources"
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-sky-700 transition-colors hover:text-sky-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Resources
            </Link>

            <article className="mt-4 rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${article.accent} text-slate-800`}
              >
                <ArticleIcon className="h-5 w-5" />
              </div>

              <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-sky-700">{article.category}</p>
              <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
                {article.title}
              </h1>
              <p className="mt-3 text-sm font-bold text-slate-500">{article.readTime}</p>

              <div className="mt-2">
                {article.content.map((block, index) => (
                  <ArticleBlock key={index} block={block} index={index} />
                ))}
              </div>
            </article>

            <div className="mt-6">
              <Link
                to="/resources"
                className="inline-flex items-center gap-1.5 text-sm font-extrabold text-sky-700 transition-colors hover:text-sky-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Resources
              </Link>
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
