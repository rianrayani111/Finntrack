import React from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import legalPack from "@/content/legalPack.md?raw";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-sky-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/login">
          <Button variant="ghost" className="mb-4 font-bold text-sky-600">
            ← Back to sign up
          </Button>
        </Link>
        <div className="finn-card">
          <article className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:text-slate-800 prose-h1:text-3xl prose-h1:font-extrabold prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-8 prose-h2:border-b prose-h2:pb-2 prose-h2:border-slate-200 prose-h3:text-lg prose-h3:font-bold prose-strong:text-slate-800 prose-a:text-sky-600 prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-li:my-1">
            <ReactMarkdown>{legalPack}</ReactMarkdown>
          </article>
        </div>
        <Link to="/login">
          <Button variant="ghost" className="mt-4 font-bold text-sky-600">
            ← Back to sign up
          </Button>
        </Link>
      </div>
    </div>
  );
}