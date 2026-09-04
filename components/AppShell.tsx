"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";

/**
 * Chrome around every page.
 *
 * The app itself is mobile-first and lives in a 480px column with the bottom
 * nav. The local image workbench is the opposite: a desktop tool that needs the
 * whole viewport for a list, a prompt and a full-size illustration side by side,
 * and has no business showing the app's navigation. Splitting here keeps one
 * root layout instead of moving every page into route groups.
 */
const FULL_WIDTH_PREFIXES = ["/admin/images"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = FULL_WIDTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (fullWidth) return <div className="min-h-dvh bg-bg">{children}</div>;

  return (
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
  );
}
