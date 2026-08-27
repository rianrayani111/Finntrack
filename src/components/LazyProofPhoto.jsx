import React, { useState } from "react";
import { Loader2 } from "lucide-react";

// Requests/tasks list queries deliberately omit the full proof_photo_url
// (up to ~800KB of base64 per row -- see migration 0017) to keep list
// fetches cheap; see requestApi.list / taskApi.list in src/api/db.js. This
// fetches and displays the actual photo only when someone asks to see it,
// one row at a time, via the caller-supplied fetchPhoto.
export default function LazyProofPhoto({ hasPhoto, fetchPhoto, alt = "Proof photo", className = "" }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!hasPhoto) return null;

  if (url) {
    return <img src={url} alt={alt} className={className} />;
  }

  const handleView = async () => {
    setLoading(true);
    setError("");
    try {
      const photoUrl = await fetchPhoto();
      if (!photoUrl) {
        setError("That photo is no longer available.");
        return;
      }
      setUrl(photoUrl);
    } catch (err) {
      setError(err.message || "Could not load photo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleView}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 hover:underline disabled:opacity-60"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {loading ? "Loading photo..." : "View photo"}
      </button>
      {error && <p className="text-xs text-red-500 font-semibold mt-1">{error}</p>}
    </div>
  );
}
