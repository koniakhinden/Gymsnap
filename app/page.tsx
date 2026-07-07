import Link from "next/link";
import { Camera, User, Zap, ChevronRight } from "lucide-react";
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
          Your AI trainer, built from a photo of your gym.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <StatusCard
          icon={Camera}
          tone={gymDone ? "success" : "neutral"}
          title="Gym setup"
          subtitle={gymDone ? `${gymData?.items.length ?? 0} items` : "Not started"}
          action={
            <Link
              href={gymDone ? "/setup/confirm" : "/setup"}
              className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              {gymDone ? "Review" : "Start"}
              <ChevronRight size={16} strokeWidth={2} />
            </Link>
          }
        />
        <StatusCard
          icon={User}
          tone={profileDone ? "success" : "neutral"}
          title="Profile"
          subtitle={profileDone ? "Saved" : "Not started"}
          action={
            <Link
              href="/profile"
              className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              {profileDone ? "Edit" : "Start"}
              <ChevronRight size={16} strokeWidth={2} />
            </Link>
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
                View plan
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
              No plan yet.{" "}
              {!gymDone || !profileDone
                ? "Finish setup and your profile first."
                : ""}
            </p>
            <Link href="/plan" className={buttonClass({ block: true })}>
              Generate week 1
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
