import Link from "next/link";
import { Camera, User, Zap, ChevronRight, NotebookPen, Utensils } from "lucide-react";
import {
  getLatestProfile,
  getLatestGymWithEquipment,
  getLatestWeek,
  getAllWeeksSummary,
} from "@/lib/plan-data";
import { getUserId } from "@/lib/user";
import { Card, StatusCard, Badge, buttonClass } from "@/components/ui";

// Reads live app state on every request — must not be statically prerendered
// at build time (when a real DATABASE_URL may not be reachable/desired anyway).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getUserId();
  const [profile, gymData, latestWeek, weeksSummary] = await Promise.all([
    getLatestProfile(userId),
    getLatestGymWithEquipment(userId),
    getLatestWeek(userId),
    getAllWeeksSummary(userId),
  ]);

  const gymDone = !!gymData && gymData.items.length > 0;
  const profileDone = !!profile;

  return (
    <main className="flex flex-col gap-5 p-4">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">GymSnap</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Equipment exercise finder — discover exercises for the equipment you
          actually have, from a photo of your gym.
        </p>
      </header>

      <section className="rounded-card border border-border bg-surface p-3 text-xs leading-relaxed text-ink-secondary">
        <p>
          GymSnap was built as my personal exercise library to quickly find
          exercises based on the equipment available in a gym, for my own
          convenience.
        </p>
        <p className="mt-2">
          The exercises shown are informational suggestions only. They are not
          personalized training programs, coaching, medical advice, or
          professional fitness recommendations. The service does not evaluate
          your health, injuries, fitness level, mobility, or medical
          conditions — you are solely responsible for deciding whether any
          exercise is appropriate for you.
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <StatusCard
          icon={Camera}
          tone={gymDone ? "success" : "neutral"}
          title="Gym setup"
          subtitle={gymDone ? `${gymData?.items.length ?? 0} items` : "Not started"}
          href={gymDone ? "/setup/confirm" : "/setup"}
          action={
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent">
              {gymDone ? "Review" : "Start"}
              <ChevronRight size={16} strokeWidth={2} />
            </span>
          }
        />
        <StatusCard
          icon={User}
          tone={profileDone ? "success" : "neutral"}
          title="Profile"
          subtitle={profileDone ? "Saved" : "Not started"}
          href="/profile"
          action={
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent">
              {profileDone ? "Edit" : "Start"}
              <ChevronRight size={16} strokeWidth={2} />
            </span>
          }
        />
        <StatusCard
          icon={NotebookPen}
          tone="neutral"
          title="Workout diary"
          subtitle="What you actually did"
          href="/diary"
          action={
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent">
              Open
              <ChevronRight size={16} strokeWidth={2} />
            </span>
          }
        />
        <StatusCard
          icon={Utensils}
          tone="neutral"
          title="Food setup"
          subtitle="Who you cook for & tastes"
          href="/nutrition"
          action={
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent">
              Open
              <ChevronRight size={16} strokeWidth={2} />
            </span>
          }
        />
      </div>

      <Link href="/quick" className={buttonClass({ size: "lg", block: true })}>
        <Zap size={20} strokeWidth={2} />
        Train now
      </Link>

      <Card className="p-4">
        <h2 className="mb-1 text-[20px] font-semibold tracking-[-0.01em]">
          Current week
        </h2>
        {latestWeek ? (
          <>
            <p className="mb-3 text-sm text-ink-secondary">
              Week {latestWeek.weekNumber} ·{" "}
              {latestWeek.checkin ? "checked in" : "check-in pending"}
            </p>
            <div className="flex gap-2">
              <Link
                href="/plan"
                className={buttonClass({ block: true, className: "flex-1" })}
              >
                View suggestions
              </Link>
              <Link
                href="/checkin"
                className={buttonClass({
                  variant: "secondary",
                  block: true,
                  className: "flex-1",
                })}
              >
                Check in
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-secondary">
              No suggestions yet.{" "}
              {!gymDone || !profileDone
                ? "Finish setup and your profile first."
                : ""}
            </p>
            <Link href="/plan" className={buttonClass({ block: true })}>
              Suggest exercises for week 1
            </Link>
          </>
        )}
      </Card>

      {weeksSummary.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-[20px] font-semibold tracking-[-0.01em]">
            Past weeks
          </h2>
          <ul className="flex flex-col divide-y divide-divider">
            {weeksSummary.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/plan?week=${w.weekNumber}`}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>Week {w.weekNumber}</span>
                  <Badge tone={w.hasCheckin ? "success" : "neutral"}>
                    {w.hasCheckin ? "checked in" : "pending"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
