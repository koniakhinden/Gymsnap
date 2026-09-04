import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
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
          On wider screens it floats on the tinted app background. AppShell drops
          that column for the local image workbench, which needs the full width. */}
      <body className="min-h-full bg-bg text-ink">
        <AppShell>{children}</AppShell>
        <DisclaimerGate />
      </body>
    </html>
  );
}
