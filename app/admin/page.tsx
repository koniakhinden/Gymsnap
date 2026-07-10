"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";

type UserRow = {
  userId: string;
  weeks: number;
  quickWorkouts: number;
  checkins: number;
  goal: string | null;
  experience: string | null;
  lastActivity: string | null;
};
type Analytics = {
  generatedAt: string;
  totals: {
    users: number;
    weeks: number;
    quickWorkouts: number;
    checkins: number;
    weeksLast7: number;
    quickLast7: number;
    activeUsersLast7: number;
  };
  daily: { date: string; weeks: number; quick: number }[];
  users: UserRow[];
};

const KEY_STORAGE = "gymsnap_admin_key";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously entered key so the dashboard opens straight away.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(KEY_STORAGE) : null;
    if (stored) {
      setKey(stored);
      setKeyInput(stored);
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/admin/analytics", { headers: { "x-admin-key": key } })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load.");
        return body as Analytics;
      })
      .then((body) => {
        if (cancelled) return;
        setData(body);
        window.localStorage.setItem(KEY_STORAGE, key);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setData(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key]);

  function submitKey(e: React.FormEvent) {
    e.preventDefault();
    setKey(keyInput.trim());
  }

  function signOut() {
    window.localStorage.removeItem(KEY_STORAGE);
    setKey("");
    setKeyInput("");
    setData(null);
    setError(null);
  }

  // ---- gate ----
  if (!key || (error && !data)) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">Admin analytics</h1>
        <p className="text-sm text-ink-secondary">Enter the admin key to view usage.</p>
        <form onSubmit={submitKey} className="flex flex-col gap-3">
          <Field label="Admin key">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="ADMIN_KEY"
              autoFocus
            />
          </Field>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" size="lg" block disabled={!keyInput.trim()}>
            View dashboard
          </Button>
        </form>
      </main>
    );
  }

  const t = data?.totals;
  const maxDaily = data
    ? Math.max(1, ...data.daily.map((d) => d.weeks + d.quick))
    : 1;

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin analytics</h1>
        <Button
          variant="secondary"
          onClick={signOut}
          className="!min-h-[40px] !px-3 !text-sm"
        >
          Sign out
        </Button>
      </header>

      {loading && !data && (
        <>
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Users" value={t!.users} sub={`${t!.activeUsersLast7} active · 7d`} />
            <Stat label="Weekly plans" value={t!.weeks} sub={`+${t!.weeksLast7} · 7d`} />
            <Stat label="Quick workouts" value={t!.quickWorkouts} sub={`+${t!.quickLast7} · 7d`} />
            <Stat label="Check-ins" value={t!.checkins} />
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Programs created · last 30 days</p>
              <div className="flex items-center gap-3 text-[11px] text-ink-tertiary">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Weekly
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-ink-disabled" /> Quick
                </span>
              </div>
            </div>
            <div className="flex h-24 items-end gap-[3px]">
              {data.daily.map((d) => {
                const total = d.weeks + d.quick;
                const h = (total / maxDaily) * 100;
                const weekShare = total > 0 ? (d.weeks / total) * 100 : 0;
                return (
                  <div
                    key={d.date}
                    className="group relative flex flex-1 items-end"
                    style={{ height: "100%" }}
                    title={`${d.date}: ${d.weeks} weekly, ${d.quick} quick`}
                  >
                    <div
                      className="w-full overflow-hidden rounded-sm bg-ink-disabled"
                      style={{ height: `${Math.max(total > 0 ? 6 : 0, h)}%` }}
                    >
                      <div className="w-full bg-accent" style={{ height: `${weekShare}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-tertiary">
              {data.daily[0]?.date} → {data.daily[data.daily.length - 1]?.date}
            </p>
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <p className="text-sm font-semibold">
              Users ({data.users.length})
            </p>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-ink-tertiary">
                    <th className="px-1 py-1.5 font-medium">User</th>
                    <th className="px-1 py-1.5 text-right font-medium">Weeks</th>
                    <th className="px-1 py-1.5 text-right font-medium">Quick</th>
                    <th className="px-1 py-1.5 text-right font-medium">Check-ins</th>
                    <th className="px-1 py-1.5 font-medium">Goal</th>
                    <th className="px-1 py-1.5 font-medium">Level</th>
                    <th className="px-1 py-1.5 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.userId} className="border-t border-divider">
                      <td className="px-1 py-1.5 font-mono text-[12px] text-ink-secondary">
                        {u.userId.slice(0, 8)}
                      </td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{u.weeks}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{u.quickWorkouts}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{u.checkins}</td>
                      <td className="px-1 py-1.5 text-ink-secondary">{u.goal ?? "—"}</td>
                      <td className="px-1 py-1.5 text-ink-secondary">{u.experience ?? "—"}</td>
                      <td className="px-1 py-1.5 text-ink-secondary">{fmtDate(u.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-center text-[11px] text-ink-tertiary">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-ink-tertiary">{sub}</span>}
    </Card>
  );
}
