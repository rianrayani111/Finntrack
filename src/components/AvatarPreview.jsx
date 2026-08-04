import React from "react";

export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", hex: "#ffe0c2" },
  { id: "peach", label: "Peach", hex: "#f4c28f" },
  { id: "tan", label: "Tan", hex: "#e0a872" },
  { id: "caramel", label: "Caramel", hex: "#c1793f" },
  { id: "brown", label: "Brown", hex: "#8d5a2b" },
  { id: "deep", label: "Deep", hex: "#5c3a21" },
];

export const HAIR_COLORS = [
  { id: "black", label: "Black", hex: "#2b2320" },
  { id: "brown", label: "Brown", hex: "#6b4423" },
  { id: "blonde", label: "Blonde", hex: "#e8c368" },
  { id: "red", label: "Red", hex: "#c1552c" },
  { id: "blue", label: "Blue", hex: "#4c7fd6" },
  { id: "pink", label: "Pink", hex: "#e8789f" },
];

export const HAIR_STYLES = [
  { id: "bald", label: "Bald" },
  { id: "short", label: "Short" },
  { id: "curly", label: "Curly" },
  { id: "long", label: "Long" },
  { id: "spiky", label: "Spiky" },
  { id: "buns", label: "Space Buns" },
];

export const FACES = [
  { id: "smile", label: "Smile" },
  { id: "grin", label: "Big Grin" },
  { id: "wink", label: "Wink" },
  { id: "cool", label: "Cool" },
  { id: "surprised", label: "Surprised" },
  { id: "shy", label: "Shy" },
];

const skinHex = (id) => SKIN_TONES.find((s) => s.id === id)?.hex || SKIN_TONES[1].hex;
const hairHex = (id) => HAIR_COLORS.find((h) => h.id === id)?.hex || HAIR_COLORS[1].hex;

function Hair({ style, color }) {
  if (style === "curly") {
    return (
      <g fill={color}>
        <circle cx="26" cy="32" r="10" />
        <circle cx="38" cy="21" r="11" />
        <circle cx="52" cy="17" r="12" />
        <circle cx="66" cy="21" r="11" />
        <circle cx="76" cy="32" r="10" />
      </g>
    );
  }
  if (style === "long") {
    return (
      <g fill={color}>
        <path d="M20 46 Q20 8 50 8 Q80 8 80 46 Q80 30 50 30 Q20 30 20 46 Z" />
        <path d="M18 40 Q13 70 20 90 Q27 90 27 70 Q27 50 30 42 Z" />
        <path d="M82 40 Q87 70 80 90 Q73 90 73 70 Q73 50 70 42 Z" />
      </g>
    );
  }
  if (style === "spiky") {
    return <path d="M20 42 L26 12 L36 34 L44 8 L50 32 L56 8 L64 34 L74 12 L80 42 Q80 28 50 28 Q20 28 20 42 Z" fill={color} />;
  }
  if (style === "buns") {
    return (
      <g fill={color}>
        <path d="M22 42 Q22 10 50 10 Q78 10 78 42 Q78 28 50 28 Q22 28 22 42 Z" />
        <circle cx="17" cy="20" r="11" />
        <circle cx="83" cy="20" r="11" />
      </g>
    );
  }
  if (style === "short") {
    return <path d="M20 44 Q20 8 50 8 Q80 8 80 44 Q80 30 50 30 Q20 30 20 44 Z" fill={color} />;
  }
  return null; // bald
}

function Face({ face }) {
  switch (face) {
    case "wink":
      return (
        <>
          <circle cx="38" cy="56" r="4" fill="#2b2320" />
          <path d="M58 56 q4 -4 8 0" stroke="#2b2320" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M38 70 q12 10 24 0" stroke="#8a4b32" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "cool":
      return (
        <>
          <rect x="29" y="50" width="18" height="10" rx="4" fill="#1f2937" />
          <rect x="53" y="50" width="18" height="10" rx="4" fill="#1f2937" />
          <rect x="47" y="53" width="6" height="3" fill="#1f2937" />
          <path d="M40 72 q10 6 20 0" stroke="#8a4b32" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "surprised":
      return (
        <>
          <circle cx="38" cy="57" r="5" fill="#2b2320" />
          <circle cx="62" cy="57" r="5" fill="#2b2320" />
          <circle cx="50" cy="73" r="6" fill="#8a4b32" />
        </>
      );
    case "shy":
      return (
        <>
          <path d="M33 57 q5 -5 10 0" stroke="#2b2320" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M57 57 q5 -5 10 0" stroke="#2b2320" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M42 71 q8 5 16 0" stroke="#8a4b32" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="30" cy="64" r="5" fill="#f472b6" opacity="0.35" />
          <circle cx="70" cy="64" r="5" fill="#f472b6" opacity="0.35" />
        </>
      );
    case "grin":
      return (
        <>
          <circle cx="38" cy="56" r="4.5" fill="#2b2320" />
          <circle cx="62" cy="56" r="4.5" fill="#2b2320" />
          <path d="M36 69 Q50 84 64 69 Z" fill="#8a4b32" />
          <path d="M41 70 Q50 76 59 70 Z" fill="#fff" opacity="0.9" />
        </>
      );
    case "smile":
    default:
      return (
        <>
          <circle cx="38" cy="56" r="4.5" fill="#2b2320" />
          <circle cx="62" cy="56" r="4.5" fill="#2b2320" />
          <path d="M38 70 q12 10 24 0" stroke="#8a4b32" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

export default function AvatarPreview({
  skin = "peach",
  hairStyle = "short",
  hairColor = "brown",
  face = "smile",
  size = 96,
  className = "",
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label="Avatar">
      <circle cx="50" cy="54" r="34" fill={skinHex(skin)} />
      {face === "shy" ? null : (
        <>
          <circle cx="30" cy="64" r="5" fill="#fff" opacity="0.18" />
          <circle cx="70" cy="64" r="5" fill="#fff" opacity="0.18" />
        </>
      )}
      <Face face={face} />
      <Hair style={hairStyle} color={hairHex(hairColor)} />
    </svg>
  );
}
