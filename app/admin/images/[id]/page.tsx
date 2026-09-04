"use client";

import { use, useState } from "react";
import Link from "next/link";
import SpendBar from "@/components/SpendBar";
import ExerciseWorkbench from "@/components/ExerciseWorkbench";

// Deep link to a single exercise. The two-pane queue at /admin/images shows the
// same component inline; this route exists so a specific exercise can be opened
// (and shared) directly.
export default function ExerciseImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [spendKey, setSpendKey] = useState(0);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <Link href="/admin/images" className="text-sm text-accent underline">
        ← К очереди
      </Link>
      <SpendBar refreshKey={spendKey} />
      <ExerciseWorkbench id={id} onChanged={() => setSpendKey((k) => k + 1)} />
    </main>
  );
}
