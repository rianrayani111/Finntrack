import React from "react";

import usePageMeta from "@/hooks/usePageMeta";
import { education } from "@/api/education";
import {
  Chip,
  ChipRow,
  Empty,
  ErrorBanner,
  PageTitle,
  Section,
  Spinner,
  formatDate,
  formatEdu,
  useLoad,
} from "@/components/student/StudentUI";

function BadgeTable({ badges, earned }) {
  if (badges.length === 0) {
    return <Empty>{earned ? "No badges unlocked yet. Keep going!" : "You've unlocked every badge!"}</Empty>;
  }
  return (
    <table className="w-full text-sm min-w-[480px]">
      <thead>
        <tr className="text-left text-slate-500 font-bold">
          <th className="pb-2">Badge</th>
          <th className="pb-2">Requirement / Description</th>
          <th className="pb-2">{earned ? "Unlocked" : "Progress"}</th>
          <th className="pb-2 text-right">Reward</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
        {badges.map((b) => (
          <tr key={b.key}>
            <td className="py-2 font-extrabold">🏅 {b.name}</td>
            <td className="py-2">{b.description}</td>
            <td className="py-2">{earned ? formatDate(b.earnedAt) : "Locked"}</td>
            <td className="py-2 text-right">{formatEdu(b.reward)} EduBucks</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StudentBadges() {
  usePageMeta("Badges", "Your badges and achievements.", "/student/badges");
  const { data: badges, loading, error } = useLoad(() => education.badges(), []);

  if (loading) return <Spinner />;
  if (!badges) return <ErrorBanner message={error} />;

  const earned = badges.filter((b) => b.earnedAt);
  const locked = badges.filter((b) => !b.earnedAt);
  const rewardsEarned = earned.reduce((sum, b) => sum + b.reward, 0);

  return (
    <div>
      <PageTitle>Badges &amp; Accomplishments Hub</PageTitle>
      <ChipRow>
        <Chip label="Unlocked" value={`${earned.length}/${badges.length} badges`} />
        <Chip label="Rewards earned" value={`${formatEdu(rewardsEarned)} EduBucks`} tone="green" />
      </ChipRow>

      <Section title="🏅 Earned Achievements (Unlocked)">
        <div className="finn-card overflow-x-auto">
          <BadgeTable badges={earned} earned />
        </div>
      </Section>

      <Section title="🔒 In Progress & Locked Achievements">
        <div className="finn-card overflow-x-auto">
          <BadgeTable badges={locked} earned={false} />
        </div>
      </Section>
    </div>
  );
}
