import { config } from "../config";
import { UrlCache, UrlRecord } from "../types";

export class InMemoryUrlCache implements UrlCache {
  readonly kind = "memory" as const;
  private readonly records = new Map<string, UrlRecord>();
  private readonly dirtyCodes = new Set<string>();

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    this.records.clear();
    this.dirtyCodes.clear();
  }

  async getRecord(code: string): Promise<UrlRecord | null> {
    return this.records.get(code) ?? null;
  }

  async hydrateRecord(record: UrlRecord): Promise<void> {
    this.records.set(record.code, { ...record, recentVisits: [...record.recentVisits] });
  }

  async recordVisit(code: string, timestamp: string): Promise<void> {
    const record = this.records.get(code);

    if (!record) {
      return;
    }

    record.clicks += 1;
    record.lastAccessedAt = timestamp;
    record.updatedAt = timestamp;
    record.recentVisits = [timestamp, ...record.recentVisits].slice(0, config.recentVisitLimit);
    this.records.set(code, { ...record });
    this.dirtyCodes.add(code);
  }

  async deleteRecord(code: string): Promise<void> {
    this.records.delete(code);
    this.dirtyCodes.delete(code);
  }

  async getDirtyCodes(): Promise<string[]> {
    return [...this.dirtyCodes];
  }

  async clearDirtyCode(code: string): Promise<void> {
    this.dirtyCodes.delete(code);
  }
}
