import { useEffect } from "react";

const DEFAULT_TITLE = "FinnTrack · Smart money habits for kids";
const DEFAULT_DESCRIPTION =
  "FinnTrack helps kids track spending and earnings, sort them into needs, wants, assets, and liabilities, and see where their money really goes.";

export default function usePageMeta(title, description) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | FinnTrack` : DEFAULT_TITLE;

    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content");
    if (meta && description) {
      meta.setAttribute("content", description);
    }

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription != null) {
        meta.setAttribute("content", previousDescription);
      } else if (meta) {
        meta.setAttribute("content", DEFAULT_DESCRIPTION);
      }
    };
  }, [title, description]);
}
