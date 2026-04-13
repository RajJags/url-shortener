import { config } from "../config";
import { UrlRepository } from "../types";
import { FileUrlRepository } from "./FileUrlRepository";
import { PostgresUrlRepository } from "./PostgresUrlRepository";

export function createUrlRepository(): UrlRepository {
  if (config.storageMode === "postgres") {
    if (!config.databaseUrl) {
      throw new Error("STORAGE_MODE=postgres requires DATABASE_URL to be set.");
    }

    return new PostgresUrlRepository(config.databaseUrl, config.databaseSsl);
  }

  return new FileUrlRepository(config.dataFile);
}
