import { UrlCache } from "../types";

interface VisitEvent {
  code: string;
  timestamp: string;
}

export class AnalyticsIngestService {
  private readonly cache: UrlCache;
  private readonly intervalMs: number;
  private readonly queue: VisitEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(cache: UrlCache, intervalMs: number) {
    this.cache = cache;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer || this.intervalMs <= 0) {
      return;
    }

    this.timer = setInterval(() => {
      void this.flush();
    }, this.intervalMs);
    this.timer.unref();
  }

  enqueueVisit(code: string, timestamp: string): void {
    this.queue.push({ code, timestamp });
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) {
      return;
    }

    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);

    try {
      await Promise.all(batch.map((event) => this.cache.recordVisit(event.code, event.timestamp)));
    } finally {
      this.flushing = false;
    }
  }
}
