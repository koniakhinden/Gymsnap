"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

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
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-[17px] font-semibold">Sync devices</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Use the same profile on another phone or computer — no account needed.
        </p>
      </div>

      {/* Generate a code for another device to enter */}
      <div className="flex flex-col gap-2">
        <Button variant="secondary" block loading={generating} onClick={getCode}>
          {generating ? "Generating…" : "Get sync code"}
        </Button>
        {genError && <p className="text-sm text-error">{genError}</p>}
        {code && (
          <div className="rounded-field border border-border bg-bg p-3 text-center">
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">{code}</p>
            <p className="mt-1 text-xs text-ink-tertiary">
              Enter this on your other device within 10 minutes.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-divider" />

      {/* Enter a code from another device */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink">
          Enter code from another device
        </label>
        <div className="flex gap-2">
          <Input
            value={entered}
            onChange={(e) => setEntered(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 font-mono uppercase tracking-[0.2em]"
          />
          <Button onClick={claim} disabled={claiming || claimed}>
            {claimed ? "Synced" : claiming ? "Syncing…" : "Sync"}
          </Button>
        </div>
        {claimError && <p className="text-sm text-error">{claimError}</p>}
        {claimed && (
          <p className="text-sm text-success">
            Synced. Reloading with your merged profile…
          </p>
        )}
      </div>
    </Card>
  );
}
