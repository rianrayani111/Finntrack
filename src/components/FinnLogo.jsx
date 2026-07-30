import React from "react";

export default function FinnLogo({ className = "w-32 h-32" }) {
  return (
    <svg
      viewBox="0 0 900 900"
      className={className}
      role="img"
      aria-label="FinnTrack logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="finnBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9e7f9" />
          <stop offset="100%" stopColor="#a9d5f0" />
        </linearGradient>
        <linearGradient id="finnPanel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fcfe" />
          <stop offset="100%" stopColor="#edf7fc" />
        </linearGradient>
        <linearGradient id="finnDolphin" x1="18%" y1="10%" x2="88%" y2="92%">
          <stop offset="0%" stopColor="#95c6e9" />
          <stop offset="100%" stopColor="#5e9ed4" />
        </linearGradient>
        <linearGradient id="finnCoin" x1="20%" y1="20%" x2="80%" y2="80%">
          <stop offset="0%" stopColor="#ffd86a" />
          <stop offset="100%" stopColor="#f0b43d" />
        </linearGradient>
      </defs>

      <rect x="12" y="12" width="876" height="876" rx="108" fill="url(#finnPanel)" stroke="url(#finnBorder)" strokeWidth="18" />

      <g transform="translate(44 34)">
        <path d="M112 329c24-71 89-115 168-115 75 0 139 30 185 82 33 38 50 84 48 129-3 49-27 91-66 122-35 27-81 42-130 42-57 0-107-17-150-49-60-46-92-109-89-171 1-20 12-32 34-40Z" fill="url(#finnDolphin)" />
        <path d="M194 247c-20-21-48-31-76-28 22-27 57-44 92-40 29 3 53 15 75 35-29 13-55 22-78 28-7 2-10 2-13 5Z" fill="#4f90c5" opacity="0.95" />
        <path d="M324 257c33-32 76-50 127-50 45 0 87 13 124 38 31 21 53 49 64 85-21 3-42 4-61 1-30-5-50-18-68-35-24-23-54-36-87-38-31-1-63 5-99-1Z" fill="url(#finnDolphin)" opacity="0.86" />
        <path d="M404 435c30 21 52 49 60 83 8 35 1 69-17 101-22 37-54 65-95 83 16-35 22-71 19-108-4-37-19-70-42-102 27-7 52-23 75-57Z" fill="url(#finnDolphinLight)" />
        <path d="M286 427c-11 28-16 59-14 92 2 34 12 67 28 98 10-25 14-51 12-78-3-31-12-63-26-112Z" fill="#4f90c5" />
        <path d="M354 503c16 38 15 79-4 123 22-9 38-24 49-45 13-24 15-51 9-81-18 6-37 8-54 3Z" fill="#6ba7d7" />
        <path d="M424 500c18 40 18 84-2 135 23-10 40-25 50-47 12-24 14-52 8-84-15 4-33 2-56-4Z" fill="#4f90c5" />
        <path d="M486 612c-12 25-15 53-8 81 23-10 40-26 52-49-13-10-28-21-44-32Z" fill="#6ba7d7" />
        <path d="M404 606c-28 25-46 58-52 99 18-7 33-18 45-33 14-17 22-38 20-62-1-3-5-5-13-4Z" fill="#eef7fd" />

        <path d="M308 428c-15 24-23 49-23 77 0 24 5 47 14 69" fill="none" stroke="#3f76aa" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M486 369c13 8 25 18 35 30" fill="none" stroke="#3f76aa" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M441 606c13 30 12 58-5 87" fill="none" stroke="#5b9fda" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" />

        <circle cx="390" cy="363" r="28" fill="#ffffff" />
        <circle cx="399" cy="363" r="16" fill="#284f74" />
        <circle cx="404" cy="358" r="5" fill="#ffffff" />
        <ellipse cx="375" cy="428" rx="18" ry="12" fill="#f3a19d" opacity="0.95" />

        <ellipse cx="574" cy="196" rx="72" ry="72" fill="url(#finnCoin)" />
        <circle cx="574" cy="196" r="50" fill="none" stroke="#e1a126" strokeWidth="8" opacity="0.52" />
        <path d="M576 148v96" stroke="#d79013" strokeWidth="14" strokeLinecap="round" />
        <path d="M552 170c0-16 12-29 30-29 19 0 31 10 31 24 0 14-7 21-28 26l-7 2c-18 5-25 12-25 24 0 14 11 25 33 25 18 0 30-7 37-16" fill="none" stroke="#d79013" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}