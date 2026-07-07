"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncDevices() {
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [entered, setEntered] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  async function getCode() {
    setGenerating(true);
    setGenError(null);
    setCode(null);
    try {
      const res = await fetch("/api/sync/code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate a code.");
      setCode(data.code);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function claim() {
    const value = entered.trim();
    if (!value) {
      setClaimError("Enter a code first.");
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/sync/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't sync this device.");
      setClaimed(true);
      // The identity cookie changed — reload so this device shows the merged
      // account's data.
      router.refresh();
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Sync devices</h2>
        <p className="text-sm text-gray-500 mt-1">
          Use the same profile on another phone or computer — no account needed.
        </p>
      </div>

      {/* Generate a code for another device to enter */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={getCode}
          disabled={generating}
          className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {generating ? "Generating…" : "Get sync code"}
        </button>
        {genError && <p className="text-sm text-red-600">{genError}</p>}
        {code && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
            <p className="text-3xl font-bold tracking-[0.3em] font-mono">{code}</p>
            <p className="text-xs text-gray-500 mt-1">
              Enter this on your other device within 10 minutes.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* Enter a code from another device */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Enter code from another device
        </label>
        <div className="flex gap-2">
          <input
            value={entered}
            onChange={(e) => setEntered(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono tracking-[0.2em] uppercase"
          />
          <button
            type="button"
            onClick={claim}
            disabled={claiming || claimed}
            className="rounded-md bg-gray-900 text-white px-4 text-sm font-semibold disabled:opacity-40"
          >
            {claimed ? "Synced" : claiming ? "Syncing…" : "Sync"}
          </button>
        </div>
        {claimError && <p className="text-sm text-red-600">{claimError}</p>}
        {claimed && (
          <p className="text-sm text-green-700">
            Synced. Reloading with your merged profile…
          </p>
        )}
      </div>
    </section>
  );
}
