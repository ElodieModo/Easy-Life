import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        <svg width="512" height="512" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="easyLifeGradIconFix" x1="12" y1="8" x2="116" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="#E11D48" />
              <stop offset="0.55" stopColor="#EC4899" />
              <stop offset="1" stopColor="#F97316" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#easyLifeGradIconFix)" />
          <path d="M23 58L64 26L105 58" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M34 60V94H94V60" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="66" r="7" fill="white" />
          <circle cx="80" cy="66" r="7" fill="white" />
          <circle cx="64" cy="73" r="6" fill="white" />
          <path d="M38 86C40.6 82.3 44.2 80.5 48 80.5C51.8 80.5 55.4 82.3 58 86" stroke="white" strokeWidth="5" strokeLinecap="round" />
          <path d="M54 89C56.5 85.6 60 83.9 64 83.9C68 83.9 71.5 85.6 74 89" stroke="white" strokeWidth="5" strokeLinecap="round" />
          <path d="M70 86C72.6 82.3 76.2 80.5 80 80.5C83.8 80.5 87.4 82.3 90 86" stroke="white" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
