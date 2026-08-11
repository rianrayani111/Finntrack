import React from "react";
import { Link } from "react-router-dom";
import PublicHeader from "@/components/PublicHeader";
import usePageMeta from "@/hooks/usePageMeta";
import rianPhoto from "@/assets/team/Rian.jpeg";
import rishaPhoto from "@/assets/team/Risha.jpeg";
import jaceyPhoto from "@/assets/team/Jacey.jpeg";

const TEAM = [
  { name: "Rian Rayani", title: "CEO", photo: rianPhoto },
  { name: "Risha Sampath", title: "Head of Marketing", photo: rishaPhoto },
  { name: "Jacey Chang", title: "Head of Design", photo: jaceyPhoto },
];

export default function About() {
  usePageMeta(
    "About Us",
    "Our mission is to make a child's money visible to them. Meet the team behind FinnTrack and the vision driving it."
  );

  return (
    <div className="home-ocean-page min-h-screen text-slate-900">
      <div className="home-ocean-bg" aria-hidden="true" />
      <div className="home-ocean-glow home-ocean-glow-a" aria-hidden="true" />
      <div className="home-ocean-glow home-ocean-glow-b" aria-hidden="true" />

      <div className="relative z-10">
        <PublicHeader active="about" />

        <main className="px-4 pb-14 pt-7 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                About Us
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
                Meet the team behind FinnTrack
              </h1>
              <p className="mt-3 max-w-[65ch] text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                We're building FinnTrack to help kids learn healthy money habits early, and to give
                parents an easy way to guide them along the way.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:p-8">
                <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                  Our Mission
                </p>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                  Every app that teaches kids about money hands them a card. But most of a child's
                  money never touches one. It's a five dollar bill in a pocket, coins from a
                  birthday, allowance in cash — and no app can see it.
                </p>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                  Our mission is to make a child's money visible to them. Not managed for them. Not
                  spent through us. Seen, labelled, and understood, in the same four words every
                  real balance sheet uses: necessity, want, asset, liability.
                </p>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                  A child who learns those four words at ten is using them at thirty. That's the
                  whole idea.
                </p>
              </section>

              <section className="rounded-[2rem] border border-white/55 bg-white/85 p-6 shadow-xl backdrop-blur-md sm:p-8">
                <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                  Our Vision
                </p>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                  A generation that grew up knowing where their money went.
                </p>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                  Not because an app managed it for them, but because they learned to look — early,
                  in small amounts, when the stakes were a five dollar bill and not a mortgage. We
                  want financial literacy to stop being a class you take at seventeen and start
                  being a habit you formed at nine.
                </p>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                  The goal isn't kids who spend less. It's adults who never had to unlearn anything.
                </p>
              </section>
            </div>

            <div className="mt-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky-700">
                Our Team
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM.map((member) => (
                <div
                  key={member.name}
                  className="rounded-[2rem] border border-white/55 bg-white/85 p-6 text-center shadow-xl backdrop-blur-md"
                >
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="mx-auto h-28 w-28 rounded-full object-cover shadow-lg ring-4 ring-white"
                  />
                  <h2 className="mt-4 text-lg font-black text-slate-900">{member.name}</h2>
                  <p className="mt-1 text-sm font-bold text-sky-700">{member.title}</p>
                </div>
              ))}
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
