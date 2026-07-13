import TrainingProfile from "@/components/TrainingProfile";
import FoodSetup from "@/components/FoodSetup";

// One place for everything about you: training profile + food setup.
export default function ProfilePage() {
  return (
    <main className="flex flex-col gap-8 p-4">
      <TrainingProfile />
      <div className="h-px w-full bg-divider" />
      <FoodSetup />
    </main>
  );
}
