import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { exerciseImageSpecs, exercises } from "@/lib/db/schema";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { getSpec, listVersions, promptForSpec, sizeForSpec } from "@/lib/image-generation";
import { figureFor } from "@/lib/image-prompt";

export const runtime = "nodejs";

const PatchSchema = z.object({
  phases: z.number().int().min(2).max(4).optional(),
  camera: z.enum(["profile", "front", "three_quarter"]).optional(),
  orientation: z.enum(["upright", "horizontal"]).optional(),
  panelDescriptions: z.array(z.string()).min(2).max(4).optional(),
  figure: z.string().min(1).optional(),
});

async function loadExercise(id: string) {
  const [row] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  return row ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;
  try {
    const { id } = await params;
    const ex = await loadExercise(id);
    if (!ex) return NextResponse.json({ error: "Unknown exercise." }, { status: 404 });

    const spec = await getSpec(id);
    const versions = await listVersions(id);
    return NextResponse.json({
      exercise: { id: ex.id, name: ex.name, equipment: ex.equipment, category: ex.category },
      spec,
      // The exact text that a generate call would send right now.
      prompt: spec ? promptForSpec(ex.name, spec) : null,
      size: spec ? sizeForSpec(spec) : null,
      versions,
    });
  } catch (err) {
    return jsonError(err, "Failed to load the exercise.");
  }
}

// Editing a spec by hand marks it edited_by_hand, which is what stops a later
// `images specs` batch from overwriting the work.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;
  try {
    const { id } = await params;
    const ex = await loadExercise(id);
    if (!ex) return NextResponse.json({ error: "Unknown exercise." }, { status: 404 });

    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid spec: ${parsed.error.issues.map((i) => i.message).join(", ")}` },
        { status: 400 }
      );
    }
    const patch = parsed.data;
    const existing = await getSpec(id);

    const phases = patch.phases ?? existing?.phases;
    const panels = patch.panelDescriptions ?? existing?.panelDescriptions;
    if (phases && panels && panels.length !== phases) {
      return NextResponse.json(
        { error: `phases=${phases} but ${panels.length} panel descriptions.` },
        { status: 400 }
      );
    }

    if (existing) {
      await db
        .update(exerciseImageSpecs)
        .set({ ...patch, editedByHand: true, updatedAt: new Date() })
        .where(eq(exerciseImageSpecs.exerciseId, id));
    } else {
      if (!phases || !panels) {
        return NextResponse.json(
          { error: "No spec yet — phases and panelDescriptions are required." },
          { status: 400 }
        );
      }
      await db.insert(exerciseImageSpecs).values({
        exerciseId: id,
        phases,
        camera: patch.camera ?? "profile",
        orientation: patch.orientation ?? "upright",
        panelDescriptions: panels,
        figure: patch.figure ?? figureFor(id),
        editedByHand: true,
      });
    }

    const spec = await getSpec(id);
    return NextResponse.json({
      spec,
      prompt: spec ? promptForSpec(ex.name, spec) : null,
      size: spec ? sizeForSpec(spec) : null,
    });
  } catch (err) {
    return jsonError(err, "Failed to save the spec.");
  }
}
