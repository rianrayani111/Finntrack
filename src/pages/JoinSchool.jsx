import React from "react";
import { Link, useSearchParams } from "react-router-dom";

import FinnAuthLayout from "@/components/FinnAuthLayout";
import TeacherSignup from "@/components/TeacherSignup";
import usePageMeta from "@/hooks/usePageMeta";

// Where a school's teacher invite link lands: /join-school?token=...
export default function JoinSchool() {
  usePageMeta("Join your school", "Create your free FinnTrack teacher account.", "/join-school");
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  return (
    <FinnAuthLayout showMascot={false}>
      {token ? (
        <TeacherSignup inviteToken={token} />
      ) : (
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-extrabold text-slate-800">This link is incomplete</h2>
          <p className="text-sm font-semibold text-slate-600">
            Ask your school admin for the full invite link, or log in if you already have an account.
          </p>
          <Link to="/login" className="inline-block font-bold text-sky-600 hover:underline">
            Go to login
          </Link>
        </div>
      )}
    </FinnAuthLayout>
  );
}
