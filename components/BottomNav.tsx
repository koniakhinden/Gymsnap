"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Zap,
  Camera,
  User,
  ClipboardList,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/quick", label: "Train", icon: Zap },
  { href: "/setup", label: "Gym", icon: Camera },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/plan", label: "Weekly", icon: ClipboardList },
  { href: "/checkin", label: "Check-in", icon: CircleCheck },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print sticky bottom-0 z-20 border-t border-hairline bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="flex px-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                  active
                    ? "font-semibold text-accent"
                    : "font-medium text-ink-tertiary",
                )}
              >
                <Icon
                  size={24}
                  strokeWidth={2}
                  className={active ? "fill-accent-subtle" : "fill-none"}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
