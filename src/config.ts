import path from "path";
import dotenv from "dotenv";

dotenv.config();

const dataFile = process.env.DATA_FILE
  ? path.resolve(process.cwd(), process.env.DATA_FILE)
  : path.resolve(process.cwd(), "data", "urls.json");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  baseUrl: process.env.BASE_URL?.trim() || "",
  defaultCodeLength: Number(process.env.CODE_LENGTH ?? 6),
  recentVisitLimit: Number(process.env.RECENT_VISIT_LIMIT ?? 10),
  dataFile,
  storageMode: process.env.STORAGE_MODE?.trim().toLowerCase() || (process.env.DATABASE_URL ? "postgres" : "file"),
  databaseUrl: process.env.DATABASE_URL?.trim() || "",
  databaseSsl: process.env.DATABASE_SSL?.trim().toLowerCase() === "true",
  cacheMode: process.env.CACHE_MODE?.trim().toLowerCase() || "memory",
  redisUrl: process.env.REDIS_URL?.trim() || "",
  analyticsFlushIntervalMs: Number(process.env.ANALYTICS_FLUSH_INTERVAL_MS ?? 5000),
  analyticsIngestIntervalMs: Number(process.env.ANALYTICS_INGEST_INTERVAL_MS ?? 250),
};
