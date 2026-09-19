import React from "react";

import { Button } from "@/components/ui/button";
import FinnLogo from "@/components/FinnLogo";
import usePageMeta from "@/hooks/usePageMeta";
import { useAuth } from "@/lib/AuthContext";

// Placeholder until the educator portal is designed.
export default function EducatorHome() {
  usePageMeta("Teacher Portal", "FinnTrack teacher portal.", "/educator");
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <FinnLogo className="w-20 h-20" />
      <h1 className="text-3xl font-extrabold text-slate-800">Test page</h1>
      <Button variant="outline" className="rounded-2xl" onClick={() => logout()}>
        Log out
      </Button>
    </div>
  );
}
