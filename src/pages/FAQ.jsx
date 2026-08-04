import React from "react";
import { Link } from "react-router-dom";
import FinnLogo from "@/components/FinnLogo";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FAQ_CATEGORIES } from "@/content/faq";

export default function FAQ() {
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
            <div className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                FAQs
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
                Frequently asked questions
              </h1>
              <p className="mt-3 max-w-[55ch] text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                Everything you need to know about how FinnTrack works, what it costs, and how we protect your child's privacy.
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {FAQ_CATEGORIES.map((section) => (
                <section
                  key={section.category}
                  className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:p-8"
                  aria-labelledby={`faq-${section.category}`}
                >
                  <h2
                    id={`faq-${section.category}`}
                    className="text-xs font-extrabold uppercase tracking-wide text-sky-700"
                  >
                    {section.category}
                  </h2>

                  <Accordion type="multiple" className="mt-2">
                    {section.items.map((item) => (
                      <AccordionItem
                        key={item.question}
                        value={item.question}
                        className="border-b border-slate-200 last:border-b-0"
                      >
                        <AccordionTrigger className="py-4 text-left text-base font-bold text-slate-800 hover:no-underline sm:text-lg">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>

            <div className="mt-6 rounded-[2rem] border border-white/55 bg-white/70 p-6 text-center shadow-lg backdrop-blur-md sm:p-8">
              <p className="text-sm font-semibold text-slate-600">
                Still have a question?{" "}
                <a href="mailto:contact@finntrack.net" className="font-extrabold text-sky-700 hover:text-sky-800">
                  contact@finntrack.net
                </a>
              </p>
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
