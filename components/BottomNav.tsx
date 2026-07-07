"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/quick", label: "Train", icon: "⚡" },
  { href: "/setup", label: "Gym", icon: "📷" },
  { href: "/profile", label: "Profile", icon: "🧑" },
  { href: "/plan", label: "Plan", icon: "📋" },
  { href: "/checkin", label: "Check-in", icon: "✅" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="flex justify-between px-1">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                  active ? "text-cyan-600" : "text-gray-500"
                }`}
              >
                <span className="text-lg leading-none">{link.icon}</span>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
