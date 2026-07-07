import Link from "next/link";
import {
  getLatestProfile,
  getLatestGymWithEquipment,
  getLatestWeek,
  getAllWeeksSummary,
} from "@/lib/plan-data";

// Reads live app state on every request — must not be statically prerendered
// at build time (when a real DATABASE_URL may not be reachable/desired anyway).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [profile, gymData, latestWeek, weeksSummary] = await Promise.all([
    getLatestProfile(),
    getLatestGymWithEquipment(),
    getLatestWeek(),
    getAllWeeksSummary(),
  ]);

  const gymDone = !!gymData && gymData.items.length > 0;
  const profileDone = !!profile;

  return (
    <main className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">GymSnap</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your AI trainer, built from a photo of your gym.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          title="Gym setup"
          done={gymDone}
          doneLabel={`${gymData?.items.length ?? 0} items`}
          href={gymDone ? "/setup/confirm" : "/setup"}
          cta={gymDone ? "Review" : "Start"}
        />
        <StatusCard
          title="Profile"
          done={profileDone}
          doneLabel="Saved"
          href="/profile"
          cta={profileDone ? "Edit" : "Start"}
        />
      </div>

      <section className="rounded-xl bg-white border border-gray-200 p-4">
        <h2 className="font-semibold mb-1">Current week</h2>
        {latestWeek ? (
          <>
            <p className="text-sm text-gray-500 mb-3">
              Week {latestWeek.weekNumber} ·{" "}
              {latestWeek.checkin ? "checked in" : "check-in pending"}
            </p>
            <div className="flex gap-2">
              <Link
                href="/plan"
                className="flex-1 rounded-lg bg-gray-900 text-white py-2.5 text-center text-sm font-semibold"
              >
                View plan
              </Link>
              <Link
                href="/checkin"
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-center text-sm font-semibold"
              >
                Check in
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">
              No plan yet.{" "}
              {!gymDone || !profileDone ? "Finish setup and your profile first." : ""}
            </p>
            <Link
              href="/plan"
              className="block rounded-lg bg-gray-900 text-white py-2.5 text-center text-sm font-semibold"
            >
              Generate week 1
            </Link>
          </>
        )}
      </section>

      {weeksSummary.length > 0 && (
        <section className="rounded-xl bg-white border border-gray-200 p-4">
          <h2 className="font-semibold mb-2">Past weeks</h2>
          <ul className="flex flex-col divide-y divide-gray-100">
            {weeksSummary.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/plan?week=${w.weekNumber}`}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>Week {w.weekNumber}</span>
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      w.hasCheckin
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {w.hasCheckin ? "checked in" : "pending"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function StatusCard({
  title,
  done,
  doneLabel,
  href,
  cta,
}: {
  title: string;
  done: boolean;
  doneLabel: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-white border border-gray-200 p-4 flex flex-col gap-1"
    >
      <span className="text-xs font-medium text-gray-500">{title}</span>
      <span className={`text-sm font-semibold ${done ? "text-green-700" : "text-gray-400"}`}>
        {done ? doneLabel : "Not started"}
      </span>
      <span className="text-xs text-cyan-700 mt-1">{cta} →</span>
    </Link>
  );
}
