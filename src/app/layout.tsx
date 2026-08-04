import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter_Tight } from "next/font/google";

import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
  weight: ["500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "CareerOS",
  description:
    "CareerOS — a Career Operating System to manage resumes, jobs, skills, analytics, and career growth in one intelligent workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${interTight.variable} ${ibmPlexMono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
