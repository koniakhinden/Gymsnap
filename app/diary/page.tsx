import { NotebookPen } from "lucide-react";
import { getDiary } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";
import { Card, EmptyState } from "@/components/ui";

// Reads live logs on every request.
export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSet(
  weight: number | null,
  weightUnit: string,
  reps: number | null,
  toFailure: boolean,
): string {
  const load = weight != null ? `${weight}${weightUnit}` : "BW";
  const count = toFailure ? "to failure" : reps != null ? `${reps}` : "?";
  return `${load} × ${count}`;
}

export default async function DiaryPage() {
  const userId = await getUserId();
  const diary = await getDiary(userId);

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold">Workout diary</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          What you actually did — weights and reps, logged automatically by date.
        </p>
      </header>

      {diary.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No workouts logged yet"
          description="Open your plan, tap “Log what you did” under any exercise, and it shows up here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {diary.map((day) => (
            <Card key={day.date} className="p-4">
              <h2 className="mb-2 text-[15px] font-semibold">{formatDate(day.date)}</h2>
              <ul className="flex flex-col divide-y divide-divider">
                {day.exercises.map((ex) => (
                  <li key={ex.entryId} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">
                      {ex.name}
                      <span className="ml-1.5 text-xs font-normal text-ink-tertiary">
                        · W{ex.weekNumber} {ex.dayLabel}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-secondary">
                      {ex.sets
                        .map((s) =>
                          formatSet(s.weight, s.weightUnit, s.reps, s.toFailure),
                        )
                        .join(",  ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
