"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Skeleton, Badge } from "@/components/ui";
import { fetchJson } from "@/lib/safe-fetch";

type Macros = { calories: number; proteinG: number; fatG: number; carbG: number };
type Meal = {
  slot: string;
  name: string;
  description: string;
  timeMin: number;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  macrosPerServing: Macros;
};
type Day = { dayLabel: string; meals: Meal[] };
type ShopItem = {
  name: string;
  amount: string;
  category: string;
  store: "mainstream" | "specialty";
  note: string;
};
type MenuResult = {
  title: string;
  servingsPerMeal: number;
  days: Day[];
  shoppingList: ShopItem[];
  notes: string[];
};
type Targets = { eaters: number; perPersonCalories: number; householdCalories: number };
type FullMenu = { id: number; weekNumber: number; targets: Targets; result: MenuResult };
type Summary = { weekNumber: number; createdAt: string; title: string };

const PROGRESS = [
  "Reading your targets and tastes...",
  "Checking what's in local stores...",
  "Balancing the week's calories...",
  "Writing meals and the shopping list...",
];

export default function MenuPage() {
  const [menu, setMenu] = useState<FullMenu | null | undefined>(undefined);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState<Set<string>>(() => new Set());

  function localDay(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function logMeal(key: string, m: Meal) {
    try {
      await fetchJson("/api/meal-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: localDay(),
          name: m.name,
          calories: m.macrosPerServing.calories,
          proteinG: m.macrosPerServing.proteinG,
          fatG: m.macrosPerServing.fatG,
          carbG: m.macrosPerServing.carbG,
        }),
      });
      setLogged((prev) => new Set(prev).add(key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log the meal.");
    }
  }

  useEffect(() => {
    load(null);
  }, []);

  async function load(week: number | null) {
    setLoading(true);
    try {
      const url = week ? `/api/menu?week=${week}` : "/api/menu";
      const data = await fetchJson<{ menu: FullMenu | null; summary: Summary[] }>(url);
      setMenu(data.menu);
      setSummary(data.summary ?? []);
    } catch (err) {
      setMenu(null);
      setError(err instanceof Error ? err.message : "Failed to load menu.");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setProgress(0);
    const timer = setInterval(() => setProgress((i) => Math.min(i + 1, PROGRESS.length - 1)), 4000);
    try {
      await fetchJson("/api/menu/generate", { method: "POST" });
      await load(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  if (loading && menu === undefined) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-12 w-full rounded-btn" />
        <Skeleton className="h-40 w-full rounded-card" />
      </main>
    );
  }

  const mainstream = menu?.result.shoppingList.filter((s) => s.store === "mainstream") ?? [];
  const specialty = menu?.result.shoppingList.filter((s) => s.store === "specialty") ?? [];
  const nextWeek = summary.length ? Math.max(...summary.map((s) => s.weekNumber)) + 1 : 1;

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold">
          {menu ? `Week ${menu.weekNumber} menu` : "Your weekly menu"}
        </h1>
        {menu && (
          <p className="mt-1 text-sm text-ink-secondary">
            {menu.targets.eaters} {menu.targets.eaters === 1 ? "person" : "people"} ·{" "}
            ~{menu.targets.perPersonCalories} kcal/person/day · {menu.result.servingsPerMeal} servings/meal
          </p>
        )}
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      {!menu && (
        <Card className="p-4 text-sm text-ink-secondary">
          No menu yet. Finish your{" "}
          <Link href="/nutrition" className="text-accent underline hover:text-accent-hover">
            Food setup
          </Link>{" "}
          (who eats + tastes + location), then generate your first week.
        </Card>
      )}

      <Button block size="lg" loading={generating} onClick={generate}>
        {generating ? "Generating..." : `Generate menu for week ${nextWeek}`}
      </Button>

      {generating && (
        <div className="flex items-center gap-2 rounded-field border border-accent-badge-border bg-accent-fill p-3 text-sm text-accent-hover">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent [animation:spin_0.7s_linear_infinite]" />
          {PROGRESS[progress]}
        </div>
      )}

      {menu && (
        <>
          {menu.result.days.map((day, di) => (
            <Card key={di} className="flex flex-col gap-2 p-4">
              <h2 className="text-[17px] font-semibold">{day.dayLabel}</h2>
              {day.meals.map((m, mi) => (
                <div key={mi} className="border-t border-divider pt-2 first:border-t-0 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {m.name}
                      <Badge tone="neutral" className="ml-1.5 align-middle">
                        {m.slot}
                      </Badge>
                    </p>
                    <span className="shrink-0 text-xs text-ink-tertiary">
                      {m.macrosPerServing.calories} kcal
                    </span>
                  </div>
                  <p className="text-xs text-ink-tertiary">
                    ~{m.timeMin} min · {m.macrosPerServing.proteinG}p / {m.macrosPerServing.fatG}f /{" "}
                    {m.macrosPerServing.carbG}c
                  </p>
                  {m.description && <p className="mt-0.5 text-[13px] text-ink-secondary">{m.description}</p>}
                  <div className="mt-1 flex items-center gap-3">
                    {logged.has(`${di}-${mi}`) ? (
                      <span className="text-xs font-medium text-success">✓ Logged today</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logMeal(`${di}-${mi}`, m)}
                        className="text-xs font-semibold text-accent hover:text-accent-hover"
                      >
                        + Ate it
                      </button>
                    )}
                  </div>
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer list-none font-medium text-accent hover:text-accent-hover">
                      Recipe
                    </summary>
                    {m.ingredients.length > 0 && (
                      <p className="mt-1 text-ink-secondary">
                        {m.ingredients.map((x) => `${x.name}${x.amount ? ` (${x.amount})` : ""}`).join(", ")}
                      </p>
                    )}
                    <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-ink-secondary">
                      {m.steps.map((s, si) => (
                        <li key={si}>{s}</li>
                      ))}
                    </ol>
                  </details>
                </div>
              ))}
            </Card>
          ))}

          {/* Shopping list */}
          {(mainstream.length > 0 || specialty.length > 0) && (
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-[17px] font-semibold">Shopping list</h2>
              {mainstream.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    Regular store
                  </p>
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {mainstream.map((s, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="text-ink">{s.name}</span>
                        <span className="text-ink-tertiary">{s.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {specialty.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    Specialty / ethnic store
                  </p>
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {specialty.map((s, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="text-ink">
                          {s.name}
                          {s.note && <span className="text-ink-tertiary"> — {s.note}</span>}
                        </span>
                        <span className="text-ink-tertiary">{s.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {menu.result.notes.length > 0 && (
            <Card className="p-3 text-xs text-ink-tertiary">
              <ul className="list-disc space-y-1 pl-4">
                {menu.result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {summary.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Past weeks</h2>
          {summary.map((s) => (
            <Card key={s.weekNumber} className="flex items-center justify-between gap-2 p-3">
              <span className="text-sm">
                Week {s.weekNumber}
                {menu?.weekNumber === s.weekNumber && (
                  <Badge tone="success" className="ml-1.5">
                    current
                  </Badge>
                )}
              </span>
              <Button
                variant="secondary"
                onClick={() => load(s.weekNumber)}
                className="!min-h-[40px] !px-3 !text-sm"
              >
                View
              </Button>
            </Card>
          ))}
        </section>
      )}

      <p className="text-center text-[11px] text-ink-tertiary">
        Menus are informational only — not medical or dietary advice. Respect your allergies.
      </p>
    </main>
  );
}
