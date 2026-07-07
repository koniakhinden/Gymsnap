import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface text-accent shadow-card">
        <Compass size={26} strokeWidth={1.8} />
      </div>
      <div className="text-[34px] font-bold leading-none tracking-[-0.02em]">
        404
      </div>
      <div className="mt-2.5 text-[15px] font-semibold">Page not found</div>
      <p className="mx-auto mt-1.5 max-w-[260px] text-sm leading-[1.5] text-ink-secondary text-pretty">
        We couldn&rsquo;t find what you were looking for. Head back home and keep
        training.
      </p>
      <Link href="/" className={buttonClass({ className: "mt-4" })}>
        Go home
      </Link>
    </main>
  );
}
