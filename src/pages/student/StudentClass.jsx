import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, List } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { education } from "@/api/education";
import {
  Chip,
  ChipRow,
  Empty,
  ErrorBanner,
  PageTitle,
  Pill,
  Section,
  SmallButton,
  Spinner,
  formatEdu,
  useLoad,
  useStudent,
} from "@/components/student/StudentUI";

const PAGE_SIZE = 6;
const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Remembered per device, like a file browser's view setting. Best-effort:
// storage can be unavailable.
const VIEW_KEY = "finntrack:class-view";
const readView = () => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
};
const writeView = (view) => {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // ignore
  }
};

function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex rounded-xl border-2 border-slate-200 bg-white p-0.5" role="group" aria-label="Layout">
      {[
        ["cards", "Cards", LayoutGrid],
        ["list", "List", List],
      ].map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-bold transition ${
            view === value ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ListView({ students }) {
  const navigate = useNavigate();
  return (
    <div className="finn-card overflow-x-auto p-0">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-left text-slate-500 font-bold border-b border-slate-100">
            <th className="px-4 py-3 w-16">Rank</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">Net worth</th>
            <th className="px-4 py-3">Job</th>
            <th className="px-4 py-3">Holdings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
          {students.map((s) => (
            <tr
              key={s.studentId}
              onClick={() => navigate(`/student/class/${s.studentId}`)}
              className={`cursor-pointer hover:bg-sky-50 ${s.isMe ? "bg-sky-50/70" : ""}`}
            >
              <td className="px-4 py-2.5 font-extrabold">{MEDALS[s.rank] || `#${s.rank}`}</td>
              <td className="px-4 py-2.5">
                <Link
                  to={`/student/class/${s.studentId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-extrabold text-slate-800 hover:text-sky-700 hover:underline"
                >
                  {s.avatarEmoji} {s.displayName}
                </Link>
                {s.isMe && <span className="text-sky-600"> (you)</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">{formatEdu(s.netWorth)}</td>
              <td className="px-4 py-2.5">{s.jobTitle || "None"}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{s.holdingsSummary ?? "Hidden"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentClass() {
  usePageMeta("Class Portfolio", "See how your class is doing.", "/student/class");
  const { summary } = useStudent();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [view, setView] = useState(readView);
  const { data: board, loading, error } = useLoad(() => education.leaderboard(), []);

  if (loading) return <Spinner />;
  if (!board) return <ErrorBanner message={error} />;

  const top = board[0];

  return (
    <div>
      <PageTitle>Class Portfolio</PageTitle>
      <ChipRow>
        <Chip label="Class rank" value={`#${summary.rank} of ${summary.classSize}`} />
        <Chip label="Net worth" value={formatEdu(summary.netWorth)} tone="green" />
        {top && <Chip label="Top net worth" value={formatEdu(top.netWorth)} tone="amber" />}
      </ChipRow>

      <Section
        title={summary.className}
        action={
          <ViewToggle
            view={view}
            onChange={(next) => {
              setView(next);
              writeView(next);
            }}
          />
        }
      >
        {board.length === 0 ? (
          <div className="finn-card">
            <Empty>No classmates yet.</Empty>
          </div>
        ) : (
          <>
            {view === "list" ? (
              <ListView students={board.slice(0, visible)} />
            ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {board.slice(0, visible).map((s) => (
                <div key={s.studentId} className={`finn-card flex flex-col ${s.isMe ? "ring-2 ring-sky-400" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-slate-800">
                      {MEDALS[s.rank] || `${s.rank}.`} {s.avatarEmoji} {s.displayName}
                      {s.isMe && <span className="text-sky-600"> (you)</span>}
                    </p>
                    <Pill tone="slate">Rank #{s.rank}</Pill>
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm font-semibold text-slate-600 flex-1">
                    <p>
                      Net worth: <span className="font-extrabold text-slate-900">{formatEdu(s.netWorth)}</span>
                    </p>
                    <p>Job: {s.jobTitle || "None"}</p>
                    {s.quote && <p className="italic text-slate-500">&ldquo;{s.quote}&rdquo;</p>}
                    <p className="text-xs">{s.holdingsSummary ?? "Holdings hidden"}</p>
                  </div>
                  <Link
                    to={`/student/class/${s.studentId}`}
                    className="mt-3 inline-flex justify-center rounded-xl border-2 border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    View chart &amp; stats
                  </Link>
                </div>
              ))}
            </div>
            )}
            <div className="flex items-center justify-end gap-3 mt-3">
              <span className="text-sm font-bold text-slate-500">
                1–{Math.min(visible, board.length)} of {board.length}
              </span>
              {visible < board.length && (
                <SmallButton onClick={() => setVisible((v) => v + PAGE_SIZE)}>View more</SmallButton>
              )}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
