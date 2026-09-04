"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/safe-fetch";
import SpendBar from "@/components/SpendBar";
import { Badge, Button, Card, Input, cn } from "@/components/ui";

type QueueRow = {
  id: string;
  name: string;
  equipment: string | null;
  category: string | null;
  phases: number | null;
  orientation: string | null;
  camera: string | null;
  editedByHand: boolean;
  state: "no-spec" | "no-image" | "pending" | "rejected" | "ready";
  activeUrl: string | null;
  pendingUrl: string | null;
  size: string | null;
  versions: number;
};
type QueueResponse = {
  rows: QueueRow[];
  equipment: string[];
  categories: string[];
  counts: Record<string, number>;
};
type Quality = "low" | "medium" | "high";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "no-spec", label: "Нет спеки" },
  { key: "no-image", label: "Нет картинки" },
  { key: "pending", label: "Ждёт приёмки" },
  { key: "rejected", label: "Отклонённые" },
  { key: "ready", label: "Готовые" },
];

const STATE_TONE: Record<QueueRow["state"], "neutral" | "warning" | "beta"> = {
  "no-spec": "neutral",
  "no-image": "neutral",
  pending: "warning",
  rejected: "warning",
  ready: "beta",
};

type JobState = "queued" | "running" | "done" | "failed" | "cancelled";
type Job = { id: string; name: string; state: JobState; error?: string };

export default function ImageQueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [filter, setFilter] = useState("all");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quality, setQuality] = useState<Quality>("high");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [spendKey, setSpendKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Set by "Прервать". The loop checks it before starting each job, so the
  // request already in flight is allowed to finish and be billed — cancelling
  // mid-call would pay for an image we then throw away.
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ filter });
    if (equipment) sp.set("equipment", equipment);
    if (category) sp.set("category", category);
    if (q) sp.set("q", q);
    try {
      setData(await fetchJson<QueueResponse>(`/api/admin/images?${sp}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter, equipment, category, q]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rows = data?.rows ?? [];
  const selectable = rows.filter((r) => r.state !== "no-spec");
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  async function runQueue() {
    const targets = rows.filter((r) => selected.has(r.id) && r.state !== "no-spec");
    if (targets.length === 0) return;
    cancelled.current = false;
    setRunning(true);
    setJobs(targets.map((t) => ({ id: t.id, name: t.name, state: "queued" })));

    for (const t of targets) {
      if (cancelled.current) {
        setJobs((js) =>
          js.map((j) => (j.state === "queued" ? { ...j, state: "cancelled" } : j))
        );
        break;
      }
      setJobs((js) => js.map((j) => (j.id === t.id ? { ...j, state: "running" } : j)));
      try {
        await fetchJson(`/api/admin/images/exercise/${encodeURIComponent(t.id)}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quality }),
        });
        setJobs((js) => js.map((j) => (j.id === t.id ? { ...j, state: "done" } : j)));
      } catch (e) {
        setJobs((js) =>
          js.map((j) =>
            j.id === t.id ? { ...j, state: "failed", error: (e as Error).message } : j
          )
        );
      }
      setSpendKey((k) => k + 1);
    }
    setRunning(false);
    load();
  }

  const doneCount = jobs.filter((j) => j.state === "done").length;
  const failedCount = jobs.filter((j) => j.state === "failed").length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Иллюстрации</h1>
          <p className="text-xs text-ink-tertiary">
            Локальный инструмент. В проде этой страницы нет.
          </p>
        </div>
        <Link href="/admin/images/review" className="text-sm text-accent underline">
          Режим приёмки →
        </Link>
      </header>

      <SpendBar refreshKey={spendKey} />

      <Card className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                filter === f.key
                  ? "border-accent-border bg-accent-fill text-accent"
                  : "border-border text-ink-secondary"
              )}
            >
              {f.label}
              {data?.counts[f.key] != null && (
                <span className="ml-1 text-ink-tertiary">{data.counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Поиск по названию или id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="rounded-md border border-border-strong px-2 text-sm"
          >
            <option value="">Любой снаряд</option>
            {data?.equipment.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-border-strong px-2 text-sm"
          >
            <option value="">Любая категория</option>
            {data?.categories.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          Качество{" "}
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            className="rounded-md border border-border-strong px-2 py-1 text-sm"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <Button onClick={runQueue} disabled={running || selected.size === 0}>
          Сгенерировать выбранные ({selected.size})
        </Button>
        {running && (
          <Button
            variant="secondary"
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Прервать
          </Button>
        )}
        {jobs.length > 0 && (
          <span className="text-xs text-ink-secondary">
            {doneCount}/{jobs.length} готово
            {failedCount > 0 && <span className="text-error"> · {failedCount} упало</span>}
          </span>
        )}
      </div>

      {jobs.length > 0 && (
        <Card className="max-h-48 overflow-auto p-3 text-xs">
          {jobs.map((j) => (
            <div key={j.id} className="flex justify-between gap-2 border-b border-divider py-1">
              <span className="truncate">{j.name}</span>
              <span
                className={cn(
                  "shrink-0",
                  j.state === "done" && "text-success",
                  j.state === "failed" && "text-error",
                  j.state === "running" && "text-accent"
                )}
              >
                {j.state}
                {j.error ? ` — ${j.error}` : ""}
              </span>
            </div>
          ))}
        </Card>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-ink-tertiary">
            <tr className="border-b border-border">
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? new Set(selectable.map((r) => r.id)) : new Set()
                    )
                  }
                />
              </th>
              <th className="p-2">Превью</th>
              <th className="p-2">Название</th>
              <th className="p-2">Снаряд</th>
              <th className="p-2">Фазы</th>
              <th className="p-2">Ориентация</th>
              <th className="p-2">Камера</th>
              <th className="p-2">Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-divider align-middle">
                <td className="p-2">
                  <input
                    type="checkbox"
                    disabled={r.state === "no-spec"}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="p-2">
                  {(r.pendingUrl ?? r.activeUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(r.pendingUrl ?? r.activeUrl) as string}
                      alt=""
                      className="h-10 w-[60px] rounded border border-border object-contain"
                    />
                  )}
                </td>
                <td className="p-2">
                  <Link
                    href={`/admin/images/${encodeURIComponent(r.id)}`}
                    className="text-accent underline"
                  >
                    {r.name}
                  </Link>
                  {r.editedByHand && (
                    <span className="ml-1 text-[10px] text-ink-tertiary">✎ правлено</span>
                  )}
                </td>
                <td className="p-2 text-ink-secondary">{r.equipment ?? "—"}</td>
                <td className="p-2 text-ink-secondary">{r.phases ?? "—"}</td>
                <td className="p-2 text-ink-secondary">{r.orientation ?? "—"}</td>
                <td className="p-2 text-ink-secondary">{r.camera ?? "—"}</td>
                <td className="p-2">
                  <Badge tone={STATE_TONE[r.state]}>{r.state}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-sm text-ink-tertiary">Ничего не найдено.</p>
        )}
      </div>
    </main>
  );
}
