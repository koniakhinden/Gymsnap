"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/safe-fetch";
import { Badge, Button, Card, Field, Input, Textarea, cn } from "@/components/ui";

type Spec = {
  exerciseId: string;
  phases: number;
  camera: string;
  orientation: string;
  panelDescriptions: string[];
  figure: string;
  templateVersion: number;
  editedByHand: boolean;
};
type Version = {
  id: string;
  version: number;
  url: string;
  status: string;
  source: string;
  model: string | null;
  quality: string | null;
  prompt: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  note: string | null;
  createdAt: string;
};
type Detail = {
  exercise: { id: string; name: string; equipment: string | null; category: string | null };
  spec: Spec | null;
  prompt: string | null;
  size: string | null;
  versions: Version[];
};
type Quality = "low" | "medium" | "high";

// The width an illustration actually gets in the day card. Almost every fault
// we found in testing is invisible at full size and obvious at this one, so the
// small copy is shown next to the large one and the decision is made on it.
const PREVIEW_PX = 180;

/**
 * Everything for one exercise: the assembled prompt, the spec fields behind it,
 * the render at both sizes, the decision buttons and the version history.
 *
 * Lives in a component rather than the page so the two-pane queue can show it
 * beside the list — the whole point of the workbench is not having to navigate
 * away from the list to look at a result.
 */
export default function ExerciseWorkbench({
  id,
  onChanged,
}: {
  id: string;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [prompt, setPrompt] = useState("");
  const [panels, setPanels] = useState<string[]>([]);
  const [phases, setPhases] = useState(2);
  const [camera, setCamera] = useState("profile");
  const [orientation, setOrientation] = useState("upright");
  const [figure, setFigure] = useState("");
  const [quality, setQuality] = useState<Quality>("high");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson<Detail>(`/api/admin/images/exercise/${encodeURIComponent(id)}`);
      setData(d);
      setPrompt(d.prompt ?? "");
      if (d.spec) {
        setPanels(d.spec.panelDescriptions);
        setPhases(d.spec.phases);
        setCamera(d.spec.camera);
        setOrientation(d.spec.orientation);
        setFigure(d.spec.figure);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const saveSpec = () =>
    act("save", async () => {
      const res = await fetchJson<{ prompt: string | null }>(
        `/api/admin/images/exercise/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phases,
            camera,
            orientation,
            figure,
            panelDescriptions: panels.slice(0, phases),
          }),
        }
      );
      // Re-sync the textarea with the prompt the saved spec now produces,
      // otherwise a hand-typed prompt would silently mask the change.
      setPrompt(res.prompt ?? "");
    });

  const generate = () =>
    act("generate", () =>
      fetchJson(`/api/admin/images/exercise/${encodeURIComponent(id)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the textarea as-is so an edited prompt can be tried without
        // committing it to the spec first.
        body: JSON.stringify({ quality, prompt: prompt || undefined }),
      })
    );

  const post = (imageId: string, action: string, body?: unknown) =>
    act(action, () =>
      fetchJson(`/api/admin/images/version/${imageId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      })
    );

  if (error && !data) return <div className="p-4 text-sm text-error">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-ink-tertiary">Загрузка…</div>;

  const pending = data.versions.find((v) => v.status === "pending") ?? null;
  const active = data.versions.find((v) => v.status === "active") ?? null;
  const shown = pending ?? active;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{data.exercise.name}</h1>
        <Badge tone="neutral">{data.exercise.equipment ?? "—"}</Badge>
        {data.spec?.editedByHand && <Badge tone="warning">✎ правлено руками</Badge>}
        {data.spec && <Badge tone="beta">шаблон v{data.spec.templateVersion}</Badge>}
      </header>

      {error && <p className="text-sm text-error">{error}</p>}

      {!data.spec && (
        <Card className="p-3 text-sm text-ink-secondary">
          Спеки нет. Сначала <code>npm run images -- specs --only {id}</code>.
        </Card>
      )}

      {data.spec && (
        <Card className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Фаз">
              <select
                value={phases}
                onChange={(e) => setPhases(Number(e.target.value))}
                className="rounded-md border border-border-strong px-2 py-1 text-sm"
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Камера">
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                className="rounded-md border border-border-strong px-2 py-1 text-sm"
              >
                {["profile", "front", "three_quarter"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ориентация">
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="rounded-md border border-border-strong px-2 py-1 text-sm"
              >
                {["upright", "horizontal"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <div className="text-sm">
              <span className="text-ink-tertiary">Холст: </span>
              <span className="font-medium">{data.size}</span>
              <span className="ml-1 text-xs text-ink-tertiary">
                (пересчитается после сохранения)
              </span>
            </div>
          </div>

          <Field label="Фигура">
            <Input value={figure} onChange={(e) => setFigure(e.target.value)} />
          </Field>

          {Array.from({ length: phases }, (_, i) => (
            <Field key={i} label={`Панель ${i + 1}`}>
              <Textarea
                rows={2}
                value={panels[i] ?? ""}
                onChange={(e) =>
                  setPanels((p) => {
                    const next = [...p];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
            </Field>
          ))}

          <div>
            <Button variant="secondary" onClick={saveSpec} disabled={busy !== null}>
              {busy === "save" ? "Сохраняю…" : "Сохранить спеку (пометит ✎)"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-2 p-3">
        <p className="text-sm font-medium">Промпт, как он уйдёт в API</p>
        <Textarea rows={18} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
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
          <Button onClick={generate} disabled={busy !== null || !data.spec}>
            {busy === "generate" ? "Рисую… (это минуты)" : "Сгенерировать"}
          </Button>
        </div>
      </Card>

      {shown && (
        <Card className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              v{shown.version} · {shown.status}
            </p>
            {shown.quality && <Badge tone="neutral">{shown.quality}</Badge>}
            <span className="text-xs text-ink-tertiary">
              {shown.width}×{shown.height}
              {shown.bytes ? ` · ${Math.round(shown.bytes / 1024)} KB` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shown.url}
              alt=""
              className="min-w-0 flex-1 rounded border border-border object-contain"
            />
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown.url}
                alt=""
                style={{ width: PREVIEW_PX }}
                className="rounded border border-border object-contain"
              />
              <p className="mt-1 text-[11px] text-ink-tertiary">
                {PREVIEW_PX}px — реальный размер
                <br />
                превью. Решай по нему.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pending && (
              <>
                <Button onClick={() => post(pending.id, "approve")} disabled={busy !== null}>
                  Approve
                </Button>
                <Input
                  placeholder="Причина отклонения"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="secondary"
                  onClick={() => post(pending.id, "reject", { note: rejectNote })}
                  disabled={busy !== null}
                >
                  Reject
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={generate} disabled={busy !== null}>
              Regenerate
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-2 p-3">
        <p className="text-sm font-medium">История версий ({data.versions.length})</p>
        {data.versions.map((v) => (
          <div key={v.id} className="flex flex-col gap-1 border-b border-divider py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.url}
                alt=""
                className="h-10 w-[60px] rounded border border-border object-contain"
              />
              <span className="font-medium">v{v.version}</span>
              <Badge
                tone={
                  v.status === "active" ? "beta" : v.status === "rejected" ? "warning" : "neutral"
                }
              >
                {v.status}
              </Badge>
              <span className="text-ink-tertiary">
                {v.model ?? "—"}
                {v.quality ? ` · ${v.quality}` : ""} ·{" "}
                {new Date(v.createdAt).toLocaleString()}
              </span>
              {v.note && <span className="text-warning-ink">{v.note}</span>}
              {v.status === "archived" && (
                <Button
                  variant="secondary"
                  onClick={() => post(v.id, "rollback")}
                  disabled={busy !== null}
                >
                  Вернуть
                </Button>
              )}
              <button
                type="button"
                onClick={() => setOpenPrompt(openPrompt === v.id ? null : v.id)}
                className="text-accent underline"
              >
                {openPrompt === v.id ? "скрыть промпт" : "промпт"}
              </button>
            </div>
            {openPrompt === v.id && (
              <pre className={cn("overflow-x-auto rounded bg-surface-sunken p-2 text-[11px]")}>
                {v.prompt ?? "—"}
              </pre>
            )}
          </div>
        ))}
        {data.versions.length === 0 && (
          <p className="text-sm text-ink-tertiary">Пока ничего не сгенерировано.</p>
        )}
      </Card>
    </div>
  );
}
