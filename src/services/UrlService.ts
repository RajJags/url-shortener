import { config } from "../config";
import { AnalyticsIngestService } from "./AnalyticsIngestService";
import { CreateShortUrlInput, CreateShortUrlResult, UrlCache, UrlRecord, UrlRepository } from "../types";
import { validateCustomAlias } from "../utils/alias";
import { validateFutureIsoDate } from "../utils/date";
import { generateShortCode } from "../utils/generateShortCode";
import { normalizeUrl } from "../utils/normalizeUrl";

export class UrlService {
  private readonly repository: UrlRepository;
  private readonly cache: UrlCache;
  private readonly analyticsIngestService: AnalyticsIngestService;

  constructor(repository: UrlRepository, cache: UrlCache, analyticsIngestService: AnalyticsIngestService) {
    this.repository = repository;
    this.cache = cache;
    this.analyticsIngestService = analyticsIngestService;
  }

  async createShortUrl(input: CreateShortUrlInput, baseUrl: string): Promise<CreateShortUrlResult> {
    const originalUrl = normalizeUrl(input.originalUrl);
    const expiresAt = input.expiresAt ? validateFutureIsoDate(input.expiresAt) : null;

    if (input.customAlias) {
      const alias = validateCustomAlias(input.customAlias);
      const existing = await this.repository.getByCode(alias);

      if (existing) {
        throw new Error("That custom alias is already in use.");
      }

      const record = this.buildRecord(alias, originalUrl, true, baseUrl, expiresAt);
      await this.repository.save(record);
      await this.cache.hydrateRecord(record);
      return { record, created: true };
    }

    const existing = await this.repository.getByOriginalUrl(originalUrl);
    if (existing) {
      return {
        record: {
          ...existing,
          shortUrl: this.composeShortUrl(baseUrl, existing.code),
        },
        created: false,
      };
    }

    const code = await this.generateUniqueCode();
    const record = this.buildRecord(code, originalUrl, false, baseUrl, expiresAt);
    await this.repository.save(record);
    await this.cache.hydrateRecord(record);

    return { record, created: true };
  }

  async getAll(baseUrl: string): Promise<UrlRecord[]> {
    const records = await this.repository.getAll();
    return records.map((record) => ({
      ...record,
      shortUrl: this.composeShortUrl(baseUrl, record.code),
    }));
  }

  async getByCode(code: string, baseUrl: string): Promise<UrlRecord | null> {
    const record = await this.getCachedOrStoredRecord(code);
    if (!record) {
      return null;
    }

    return {
      ...record,
      shortUrl: this.composeShortUrl(baseUrl, record.code),
    };
  }

  async resolve(code: string, baseUrl: string): Promise<UrlRecord | null> {
    const record = await this.getCachedOrStoredRecord(code);

    if (!record) {
      return null;
    }

    if (this.isExpired(record)) {
      return null;
    }

    const now = new Date().toISOString();
    this.analyticsIngestService.enqueueVisit(code, now);

    const predicted: UrlRecord = {
      ...record,
      clicks: record.clicks + 1,
      lastAccessedAt: now,
      updatedAt: now,
      recentVisits: [now, ...record.recentVisits].slice(0, config.recentVisitLimit),
      shortUrl: this.composeShortUrl(baseUrl, record.code),
    };

    return predicted;
  }

  async delete(code: string): Promise<boolean> {
    const deleted = await this.repository.delete(code);

    if (deleted) {
      await this.cache.deleteRecord(code);
    }

    return deleted;
  }

  private buildRecord(
    code: string,
    originalUrl: string,
    customAlias: boolean,
    baseUrl: string,
    expiresAt: string | null,
  ): UrlRecord {
    const now = new Date().toISOString();

    return {
      code,
      originalUrl,
      shortUrl: this.composeShortUrl(baseUrl, code),
      customAlias,
      clicks: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: null,
      expiresAt,
      recentVisits: [],
    };
  }

  private composeShortUrl(baseUrl: string, code: string): string {
    const normalizedBase = (baseUrl || config.baseUrl || "http://localhost:3000").replace(/\/+$/, "");
    return `${normalizedBase}/${code}`;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateShortCode(config.defaultCodeLength);
      const existing = await this.repository.getByCode(code);

      if (!existing) {
        return code;
      }
    }

    throw new Error("Unable to generate a unique short code after several attempts.");
  }

  private isExpired(record: UrlRecord): boolean {
    return Boolean(record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now());
  }

  private async getCachedOrStoredRecord(code: string): Promise<UrlRecord | null> {
    const cached = await this.cache.getRecord(code);

    if (cached) {
      return cached;
    }

    const stored = await this.repository.getByCode(code);

    if (stored) {
      await this.cache.hydrateRecord(stored);
    }

    return stored;
  }
}
