import { UrlCache, UrlRepository } from "../types";

export class AnalyticsFlushService {
  private readonly repository: UrlRepository;
  private readonly cache: UrlCache;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(repository: UrlRepository, cache: UrlCache, intervalMs: number) {
    this.repository = repository;
    this.cache = cache;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer || this.intervalMs <= 0) {
      return;
    }

    this.timer = setInterval(() => {
      void this.flushDirtyRecords();
    }, this.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.flushDirtyRecords();
  }

  async flushDirtyRecords(): Promise<void> {
    if (this.flushing) {
      return;
    }

    this.flushing = true;

    try {
      const dirtyCodes = await this.cache.getDirtyCodes();

      for (const code of dirtyCodes) {
        const cachedRecord = await this.cache.getRecord(code);

        if (!cachedRecord) {
          await this.cache.clearDirtyCode(code);
          continue;
        }

        await this.repository.save(cachedRecord);
        await this.cache.clearDirtyCode(code);
      }
    } finally {
      this.flushing = false;
    }
  }
}
