import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { filterQueue, loadQueue, type QueueFilter } from "@/lib/image-admin";

export const runtime = "nodejs";

// Queue for the local image workbench. 404 in production — see lib/local-only.
export async function GET(req: NextRequest) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;

  try {
    const sp = new URL(req.url).searchParams;
    const rows = await loadQueue();
    const filtered = filterQueue(rows, {
      filter: (sp.get("filter") ?? "all") as QueueFilter,
      equipment: sp.get("equipment") ?? undefined,
      category: sp.get("category") ?? undefined,
      q: sp.get("q") ?? undefined,
    });

    // Facets come from the unfiltered set so the dropdowns don't collapse to
    // whatever the current filter happens to leave behind.
    const equipment = [...new Set(rows.map((r) => r.equipment).filter(Boolean))].sort();
    const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.state] = (acc[r.state] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ rows: filtered, equipment, categories, counts });
  } catch (err) {
    return jsonError(err, "Failed to load the image queue.");
  }
}
