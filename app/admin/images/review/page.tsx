"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/safe-fetch";
import { Badge, Button, Card, Input } from "@/components/ui";

type QueueRow = {
  id: string;
  name: string;
  equipment: string | null;
  phases: number | null;
  orientation: string | null;
  pendingUrl: string | null;
  pendingImageId: string | null;
};

const PREVIEW_PX = 180;

/**
 * Flow review: one pending render at a time, keyboard-driven.
 *
 * A/R/G and the arrows exist because 400+ images cannot be reviewed with a
 * mouse in any reasonable time. The small copy sits beside the large one for
 * the same reason as on the detail screen — the faults only show at 180px.
 */
export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const noteRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson<{ rows: QueueRow[] }>("/api/admin/images?filter=pending");
      setQueue(d.rows.filter((r) => r.pendingImageId));
      setI(0);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[i] ?? null;

  const act = useCallback(
    async (action: "approve" | "reject", body?: unknown) => {
      if (!current?.pendingImageId || busy) return;
      setBusy(true);
      setError(null);
      try {
        await fetchJson(`/api/admin/images/version/${current.pendingImageId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        // Drop the decided row rather than reloading: the list would otherwise
        // shift under the cursor and lose your place mid-run.
        setQueue((q) => q.filter((_, idx) => idx !== i));
        setI((idx) => Math.min(idx, Math.max(0, queue.length - 2)));
        setNote("");
        setDone((d) => d + 1);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, i, queue.length]
  );

  const regenerate = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/admin/images/exercise/${encodeURIComponent(current.id)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [current, busy, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing in the reject-reason field.
      if (document.activeElement === noteRef.current) return;
      if (e.key === "a" || e.key === "A") act("approve");
      else if (e.key === "r" || e.key === "R") act("reject", { note });
      else if (e.key === "g" || e.key === "G") regenerate();
      else if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, queue.length - 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, regenerate, note, queue.length]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/images" className="text-sm text-accent underline">
          ← К очереди
        </Link>
        <p className="text-xs text-ink-tertiary">
          <kbd>A</kbd> approve · <kbd>R</kbd> reject · <kbd>G</kbd> regenerate · ←/→ листать
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {!current ? (
        <Card className="p-6 text-center text-sm text-ink-tertiary">
          {done > 0 ? `Очередь пуста. Обработано за сессию: ${done}.` : "Нечего принимать."}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{current.name}</span>
            <Badge tone="neutral">{current.equipment ?? "—"}</Badge>
            <Badge tone="neutral">
              {current.phases ?? "?"} фаз · {current.orientation ?? "?"}
            </Badge>
            <span className="text-xs text-ink-tertiary">
              {i + 1} из {queue.length} · обработано {done}
            </span>
            <Link
              href={`/admin/images/${encodeURIComponent(current.id)}`}
              className="text-xs text-accent underline"
            >
              открыть карточку
            </Link>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            {current.pendingUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.pendingUrl}
                  alt=""
                  className="min-w-0 flex-1 rounded border border-border object-contain"
                />
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.pendingUrl}
                    alt=""
                    style={{ width: PREVIEW_PX }}
                    className="rounded border border-border object-contain"
                  />
                  <p className="mt-1 text-[11px] text-ink-tertiary">
                    {PREVIEW_PX}px — реальный
                    <br />
                    размер превью
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => act("approve")} disabled={busy}>
              Approve (A)
            </Button>
            <Input
              ref={noteRef}
              placeholder="Причина отклонения"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="secondary" onClick={() => act("reject", { note })} disabled={busy}>
              Reject (R)
            </Button>
            <Button variant="ghost" onClick={regenerate} disabled={busy}>
              Regenerate (G)
            </Button>
            {busy && <span className="text-xs text-ink-tertiary">…</span>}
          </div>
        </Card>
      )}
    </main>
  );
}
