export interface UrlRecord {
  code: string;
  originalUrl: string;
  shortUrl: string;
  customAlias: boolean;
  clicks: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  recentVisits: string[];
}

export interface CreateShortUrlInput {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
}

export interface CreateShortUrlResult {
  record: UrlRecord;
  created: boolean;
}

export interface UrlRepository {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAll(): Promise<UrlRecord[]>;
  getByCode(code: string): Promise<UrlRecord | null>;
  getByOriginalUrl(originalUrl: string): Promise<UrlRecord | null>;
  save(record: UrlRecord): Promise<void>;
  delete(code: string): Promise<boolean>;
}

export interface UrlCache {
  readonly kind: "memory" | "redis";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getRecord(code: string): Promise<UrlRecord | null>;
  hydrateRecord(record: UrlRecord): Promise<void>;
  recordVisit(code: string, timestamp: string): Promise<void>;
  deleteRecord(code: string): Promise<void>;
  getDirtyCodes(): Promise<string[]>;
  clearDirtyCode(code: string): Promise<void>;
}
