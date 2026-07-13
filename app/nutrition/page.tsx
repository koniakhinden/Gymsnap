import { redirect } from "next/navigation";

// Food setup now lives on the combined Profile page.
export default function NutritionRedirect() {
  redirect("/profile");
}
