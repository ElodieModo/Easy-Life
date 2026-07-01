import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Easy Life | Organisation Familiale",
  description: "Easy Life centralise le planning, les courses et les informations utiles de votre famille.",
  applicationName: "Easy Life",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-512-v3.png?v=4", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-touch-icon-v3.png?v=4", type: "image/png", sizes: "180x180" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
  appleWebApp: {
    capable: true,
    title: "Easy Life",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c74f73",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
