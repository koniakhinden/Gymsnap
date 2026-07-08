import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import DisclaimerGate from "@/components/DisclaimerGate";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "GymSnap — Equipment Exercise Finder",
  description:
    "Equipment-based exercise library: photograph your gym and discover exercises you can do with the equipment you have.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GymSnap",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      {/* Mobile-first: the app lives in a centered column capped at 480px.
          On wider screens it floats on the tinted app background. */}
      <body className="min-h-full bg-bg text-ink">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg shadow-pop sm:min-h-dvh">
          <div className="no-print flex justify-end px-4 pt-2 -mb-1">
            <span className="inline-flex items-center rounded-pill border border-accent-badge-border bg-accent-fill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
              Beta
            </span>
          </div>
          <div className="flex-1 pb-2">{children}</div>
          <footer className="no-print px-4 pb-2 text-center">
            <a href="/legal" className="text-[11px] text-ink-tertiary underline">
              Terms of Use · Privacy · Disclaimers
            </a>
          </footer>
          <BottomNav />
        </div>
        <DisclaimerGate />
      </body>
    </html>
  );
}
