import { createClient, RedisClientType } from "redis";
import { config } from "../config";
import { UrlCache, UrlRecord } from "../types";

function metadataKey(code: string): string {
  return `url:meta:${code}`;
}

function analyticsKey(code: string): string {
  return `url:analytics:${code}`;
}

function recentVisitsKey(code: string): string {
  return `url:recent:${code}`;
}

const DIRTY_SET_KEY = "url:analytics:dirty";

export class RedisUrlCache implements UrlCache {
  readonly kind = "redis" as const;
  private readonly client: RedisClientType;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async getRecord(code: string): Promise<UrlRecord | null> {
    const [metadata, analytics, recentVisits] = await Promise.all([
      this.client.hGetAll(metadataKey(code)),
      this.client.hGetAll(analyticsKey(code)),
      this.client.lRange(recentVisitsKey(code), 0, config.recentVisitLimit - 1),
    ]);

    if (!metadata.code) {
      return null;
    }

    return {
      code: metadata.code,
      originalUrl: metadata.originalUrl,
      shortUrl: metadata.shortUrl,
      customAlias: metadata.customAlias === "true",
      clicks: Number(analytics.clicks ?? metadata.clicks ?? 0),
      createdAt: metadata.createdAt,
      updatedAt: analytics.updatedAt ?? metadata.updatedAt,
      lastAccessedAt: analytics.lastAccessedAt || metadata.lastAccessedAt || null,
      expiresAt: metadata.expiresAt || null,
      recentVisits,
    };
  }

  async hydrateRecord(record: UrlRecord): Promise<void> {
    const multi = this.client.multi();

    multi.hSet(metadataKey(record.code), {
      code: record.code,
      originalUrl: record.originalUrl,
      shortUrl: record.shortUrl,
      customAlias: String(record.customAlias),
      clicks: String(record.clicks),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAccessedAt: record.lastAccessedAt ?? "",
      expiresAt: record.expiresAt ?? "",
    });
    multi.hSet(analyticsKey(record.code), {
      clicks: String(record.clicks),
      updatedAt: record.updatedAt,
      lastAccessedAt: record.lastAccessedAt ?? "",
    });
    multi.del(recentVisitsKey(record.code));

    if (record.recentVisits.length > 0) {
      multi.rPush(recentVisitsKey(record.code), record.recentVisits);
      multi.lTrim(recentVisitsKey(record.code), 0, config.recentVisitLimit - 1);
    }

    await multi.exec();

    if (record.expiresAt) {
      const expiresAt = new Date(record.expiresAt);
      if (!Number.isNaN(expiresAt.getTime())) {
        await Promise.all([
          this.client.expireAt(metadataKey(record.code), expiresAt),
          this.client.expireAt(analyticsKey(record.code), expiresAt),
          this.client.expireAt(recentVisitsKey(record.code), expiresAt),
        ]);
      }
    }
  }

  async recordVisit(code: string, timestamp: string): Promise<void> {
    const multi = this.client.multi();
    multi.hIncrBy(analyticsKey(code), "clicks", 1);
    multi.hSet(analyticsKey(code), {
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
    });
    multi.lPush(recentVisitsKey(code), timestamp);
    multi.lTrim(recentVisitsKey(code), 0, config.recentVisitLimit - 1);
    multi.sAdd(DIRTY_SET_KEY, code);
    await multi.exec();
  }

  async deleteRecord(code: string): Promise<void> {
    await this.client.del([metadataKey(code), analyticsKey(code), recentVisitsKey(code)]);
    await this.client.sRem(DIRTY_SET_KEY, code);
  }

  async getDirtyCodes(): Promise<string[]> {
    return this.client.sMembers(DIRTY_SET_KEY);
  }

  async clearDirtyCode(code: string): Promise<void> {
    await this.client.sRem(DIRTY_SET_KEY, code);
  }
}
