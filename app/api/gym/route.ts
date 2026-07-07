import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gyms, equipmentItems, gymPhotos } from "@/lib/db/schema";
import { confirmEquipmentRequestSchema } from "@/lib/validation/equipment";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const gym = db.select().from(gyms).orderBy(desc(gyms.id)).limit(1).get();
  if (!gym) {
    return NextResponse.json({ gym: null, items: [] });
  }
  const items = db
    .select()
    .from(equipmentItems)
    .where(eq(equipmentItems.gymId, gym.id))
    .all();
  return NextResponse.json({ gym, items });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confirmEquipmentRequestSchema.parse(body);

    const now = new Date().toISOString();
    const gym = db.insert(gyms).values({ createdAt: now }).returning().get();

    for (const item of parsed.items) {
      db.insert(equipmentItems)
        .values({
          gymId: gym.id,
          name: item.name,
          category: item.category,
          details: item.details,
          confidence: item.confidence,
          source: item.source,
          createdAt: now,
        })
        .run();
    }

    for (const filename of parsed.photoFilenames) {
      db.insert(gymPhotos).values({ gymId: gym.id, filename, createdAt: now }).run();
    }

    return NextResponse.json({ gymId: gym.id });
  } catch (err) {
    console.error("save gym error:", err);
    const message = err instanceof Error ? err.message : "Failed to save equipment list.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
