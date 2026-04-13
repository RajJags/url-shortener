import { config } from "../config";
import { UrlCache } from "../types";
import { InMemoryUrlCache } from "./InMemoryUrlCache";
import { RedisUrlCache } from "./RedisUrlCache";

export function createUrlCache(): UrlCache {
  if (config.cacheMode === "redis") {
    if (!config.redisUrl) {
      throw new Error("CACHE_MODE=redis requires REDIS_URL to be set.");
    }

    return new RedisUrlCache(config.redisUrl);
  }

  return new InMemoryUrlCache();
}
