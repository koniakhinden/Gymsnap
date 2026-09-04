"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/safe-fetch";

type Spend = {
  today: number;
  total: number;
  byQuality: Record<string, number>;
  estimatedTodayUsd: number;
  estimatedTotalUsd: number;
};

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Header strip with the running spend estimate. Deliberately labelled as an
 *  estimate: it counts our own rows, so it misses failed-but-billed calls and
 *  any price change. The real number lives in the OpenAI console. */
export default function SpendBar({ refreshKey }: { refreshKey?: number }) {
  const [spend, setSpend] = useState<Spend | null>(null);

  useEffect(() => {
    fetchJson<Spend>("/api/admin/images/stats")
      .then(setSpend)
      .catch(() => setSpend(null));
  }, [refreshKey]);

  if (!spend) return null;
  const tiers = Object.entries(spend.byQuality)
    .map(([q, n]) => `${q} ${n}`)
    .join(" · ");

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink-secondary">
      <span className="font-medium text-ink">Сегодня {spend.today}</span> ·{" "}
      {usd(spend.estimatedTodayUsd)} &nbsp;|&nbsp;{" "}
      <span className="font-medium text-ink">Всего {spend.total}</span> ·{" "}
      {usd(spend.estimatedTotalUsd)}
      {tiers && <span className="ml-2 text-ink-tertiary">({tiers})</span>}
      <span className="ml-2 text-ink-tertiary">
        — оценка по числу строк, не биллинг. Точные суммы в консоли OpenAI.
      </span>
    </div>
  );
}
