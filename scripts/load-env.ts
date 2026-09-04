// Side-effect module: loads .env.local before anything imports lib/db.
//
// It has to be its own module because ES imports are evaluated in order and
// before the importing module's body, so a plain `process.loadEnvFile(...)` call
// at the top of a script would still run after lib/db has already read
// DATABASE_URL. This is the role `dotenv/config` plays elsewhere — the project
// has no dotenv dependency and uses Node's built-in loader instead
// (same approach as drizzle.config.ts and scripts/migrate.ts).
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — assume env vars are already exported
}
