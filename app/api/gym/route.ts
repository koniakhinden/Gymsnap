import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gyms, equipmentItems, gymPhotos } from "@/lib/db/schema";
import { confirmEquipmentRequestSchema } from "@/lib/validation/equipment";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const gymRows = await db.select().from(gyms).orderBy(desc(gyms.id)).limit(1);
  const gym = gymRows[0];
  if (!gym) {
    return NextResponse.json({ gym: null, items: [] });
  }
  const items = await db
    .select()
    .from(equipmentItems)
    .where(eq(equipmentItems.gymId, gym.id));
  return NextResponse.json({ gym, items });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confirmEquipmentRequestSchema.parse(body);

    const now = new Date().toISOString();
    const [gym] = await db.insert(gyms).values({ createdAt: now }).returning();

    for (const item of parsed.items) {
      await db.insert(equipmentItems).values({
        gymId: gym.id,
        name: item.name,
        category: item.category,
        details: item.details,
        confidence: item.confidence,
        source: item.source,
        createdAt: now,
      });
    }

    for (const url of parsed.photoUrls) {
      await db.insert(gymPhotos).values({ gymId: gym.id, url, createdAt: now });
    }

    return NextResponse.json({ gymId: gym.id });
  } catch (err) {
    console.error("save gym error:", err);
    const message = err instanceof Error ? err.message : "Failed to save equipment list.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
