"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/safe-fetch";
import SpendBar from "@/components/SpendBar";
import ExerciseWorkbench from "@/components/ExerciseWorkbench";
import { Badge, Button, Input, cn } from "@/components/ui";

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
  used: number;
  prescribed: number;
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
  // «Реально выдавались» — упражнения, хотя бы раз попавшие в план, разминку,
  // растяжку или «Train now». Их несколько сотен из 900, и рисовать имеет смысл
  // сначала их: длинный хвост библиотеки пользователь может не увидеть никогда.
  const [usedOnly, setUsedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
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
    if (usedOnly) sp.set("used", "1");
    try {
      setData(await fetchJson<QueueResponse>(`/api/admin/images?${sp}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter, equipment, category, q, usedOnly]);

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

  async function runQueue(targets: QueueRow[], endpoint: "generate" | "spec" = "generate") {
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
        await fetchJson(`/api/admin/images/exercise/${encodeURIComponent(t.id)}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpoint === "generate" ? { quality } : {}),
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

  // "Все без фото" ignores the current filter on purpose: it means every
  // exercise that has a spec and no render anywhere in the library, not just
  // the ones the sidebar happens to be showing.
  async function runAllMissing() {
    const all = await fetchJson<QueueResponse>(
      `/api/admin/images?filter=no-image${usedOnly ? "&used=1" : ""}`
    );
    const targets = all.rows.filter((r) => r.state === "no-image");
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `Сгенерировать ${targets.length} картинок на качестве "${quality}"` +
          `${usedOnly ? " (только реально выдававшиеся)" : ""}? Это платно и займёт часы.`
      )
    ) {
      return;
    }
    runQueue(targets);
  }

  // Specs are the cheap prerequisite — Claude tokens, not image dollars — so this
  // runs over everything currently listed without a spec, with no confirmation.
  async function runAllSpecs() {
    const all = await fetchJson<QueueResponse>(
      `/api/admin/images?filter=no-spec${usedOnly ? "&used=1" : ""}`
    );
    runQueue(all.rows.filter((r) => r.state === "no-spec"), "spec");
  }

  const doneCount = jobs.filter((j) => j.state === "done").length;
  const failedCount = jobs.filter((j) => j.state === "failed").length;
  const missingCount =
    (usedOnly ? data?.counts["used-no-image"] : data?.counts["no-image"]) ?? 0;
  const noSpecCount =
    (usedOnly ? data?.counts["used-no-spec"] : data?.counts["no-spec"]) ?? 0;

  return (
    <main className="flex h-dvh flex-col gap-2 p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold">Иллюстрации</h1>
          <span className="text-xs text-ink-tertiary">
            локальный инструмент, в проде страницы нет
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SpendBar refreshKey={spendKey} />
          <Link href="/admin/images/review" className="text-sm text-accent underline">
            Приёмка →
          </Link>
        </div>
      </header>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex min-h-0 flex-1 gap-3">
        {/* ── Левая панель: выбор упражнения ───────────────────────────── */}
        <aside className="flex w-[360px] shrink-0 flex-col gap-2 rounded-lg border border-border bg-surface p-2">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px]",
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

          <label
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
              usedOnly
                ? "border-accent-border bg-accent-fill text-accent"
                : "border-border text-ink-secondary"
            )}
          >
            <input
              type="checkbox"
              checked={usedOnly}
              onChange={(e) => setUsedOnly(e.target.checked)}
            />
            только реально выдававшиеся
            {data?.counts.used != null && (
              <span className="ml-auto text-ink-tertiary">{data.counts.used}</span>
            )}
          </label>

          <Input
            placeholder="Поиск по названию или id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex gap-1">
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border-strong px-1 py-1 text-xs"
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
              className="min-w-0 flex-1 rounded-md border border-border-strong px-1 py-1 text-xs"
            >
              <option value="">Любая категория</option>
              {data?.categories.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(selectable.map((r) => r.id)) : new Set())
              }
            />
            выбрать всё в списке ({selectable.length})
          </label>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id}>
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-2 border-b border-divider px-1 py-1.5",
                    open === r.id && "bg-accent-fill"
                  )}
                  onClick={() => setOpen(r.id)}
                >
                  <input
                    type="checkbox"
                    disabled={r.state === "no-spec"}
                    checked={selected.has(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(r.id)}
                  />
                  {r.pendingUrl ?? r.activeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(r.pendingUrl ?? r.activeUrl) as string}
                      alt=""
                      className="h-8 w-12 shrink-0 rounded border border-border object-contain"
                    />
                  ) : (
                    <span className="h-8 w-12 shrink-0 rounded border border-dashed border-border" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{r.name}</span>
                    <span className="block truncate text-[11px] text-ink-tertiary">
                      {r.used > 0 && (
                        <span className="text-accent">выдач {r.used} · </span>
                      )}
                      {r.equipment ?? "—"}
                      {r.phases ? ` · ${r.phases}ф · ${r.orientation}` : ""}
                      {r.editedByHand ? " · ✎" : ""}
                    </span>
                  </span>
                  <Badge tone={STATE_TONE[r.state]}>{r.state}</Badge>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="p-3 text-xs text-ink-tertiary">Ничего не найдено.</li>
            )}
          </ul>

          <div className="flex flex-col gap-1.5 border-t border-border pt-2">
            <label className="text-xs">
              Качество{" "}
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                className="rounded-md border border-border-strong px-1 py-0.5 text-xs"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <Button
              variant="secondary"
              onClick={runAllSpecs}
              disabled={running || noSpecCount === 0}
            >
              Сделать спеки ({noSpecCount})
            </Button>
            <Button
              onClick={() => runQueue(rows.filter((r) => selected.has(r.id) && r.state !== "no-spec"))}
              disabled={running || selected.size === 0}
            >
              Сгенерировать выбранные ({selected.size})
            </Button>
            <Button variant="secondary" onClick={runAllMissing} disabled={running}>
              {usedOnly ? "Выдававшиеся без фото" : "Все без фото"} ({missingCount})
            </Button>
            {running && (
              <Button
                variant="ghost"
                onClick={() => {
                  cancelled.current = true;
                }}
              >
                Прервать
              </Button>
            )}
            {jobs.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-[11px]">
                <p className="text-ink-secondary">
                  {doneCount}/{jobs.length} готово
                  {failedCount > 0 && <span className="text-error"> · {failedCount} упало</span>}
                </p>
                {jobs
                  .filter((j) => j.state !== "queued")
                  .map((j) => (
                    <div key={j.id} className="flex justify-between gap-1">
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
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Правая панель: промпт, генерация, результат ───────────────── */}
        <section className="min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-3">
          {open ? (
            <ExerciseWorkbench
              key={open}
              id={open}
              onChanged={() => {
                setSpendKey((k) => k + 1);
                load();
              }}
            />
          ) : (
            <p className="p-8 text-center text-sm text-ink-tertiary">
              Выбери упражнение слева.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
