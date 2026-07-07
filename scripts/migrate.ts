import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../lib/db";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
