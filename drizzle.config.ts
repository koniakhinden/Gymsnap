import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — assume DATABASE_URL is already in the environment
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only required for `db:migrate` / `db push` / introspection; `generate` just diffs schema.ts.
    url: process.env.DATABASE_URL ?? "",
  },
});
