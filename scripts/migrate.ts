async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local not present — assume env vars are already exported
  }

  // Dynamic imports so DATABASE_URL is loaded before lib/db reads it.
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  const { db } = await import("../lib/db");

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
