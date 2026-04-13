import { Pool } from "pg";
import { UrlRecord, UrlRepository } from "../types";

function mapRowToRecord(row: Record<string, unknown>): UrlRecord {
  const recentVisits = Array.isArray(row.recent_visits)
    ? row.recent_visits.map((value) => String(value))
    : [];

  return {
    code: String(row.code),
    originalUrl: String(row.original_url),
    shortUrl: String(row.short_url),
    customAlias: Boolean(row.custom_alias),
    clicks: Number(row.clicks),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastAccessedAt: row.last_accessed_at ? new Date(String(row.last_accessed_at)).toISOString() : null,
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    recentVisits,
  };
}

export class PostgresUrlRepository implements UrlRepository {
  private readonly pool: Pool;

  constructor(connectionString: string, ssl: boolean) {
    this.pool = new Pool({
      connectionString,
      ssl: ssl ? { rejectUnauthorized: false } : false,
    });
  }

  async connect(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS short_urls (
        code TEXT PRIMARY KEY,
        original_url TEXT NOT NULL,
        short_url TEXT NOT NULL,
        custom_alias BOOLEAN NOT NULL DEFAULT FALSE,
        clicks INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        last_accessed_at TIMESTAMPTZ NULL,
        expires_at TIMESTAMPTZ NULL,
        recent_visits TEXT[] NOT NULL DEFAULT '{}'
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS short_urls_original_url_idx
      ON short_urls (original_url)
    `);
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async getAll(): Promise<UrlRecord[]> {
    const result = await this.pool.query(
      "SELECT * FROM short_urls ORDER BY created_at DESC",
    );

    return result.rows.map(mapRowToRecord);
  }

  async getByCode(code: string): Promise<UrlRecord | null> {
    const result = await this.pool.query(
      "SELECT * FROM short_urls WHERE code = $1 LIMIT 1",
      [code],
    );

    return result.rows[0] ? mapRowToRecord(result.rows[0]) : null;
  }

  async getByOriginalUrl(originalUrl: string): Promise<UrlRecord | null> {
    const result = await this.pool.query(
      `
        SELECT *
        FROM short_urls
        WHERE original_url = $1
          AND custom_alias = FALSE
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [originalUrl],
    );

    return result.rows[0] ? mapRowToRecord(result.rows[0]) : null;
  }

  async save(record: UrlRecord): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO short_urls (
          code,
          original_url,
          short_url,
          custom_alias,
          clicks,
          created_at,
          updated_at,
          last_accessed_at,
          expires_at,
          recent_visits
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (code)
        DO UPDATE SET
          original_url = EXCLUDED.original_url,
          short_url = EXCLUDED.short_url,
          custom_alias = EXCLUDED.custom_alias,
          clicks = EXCLUDED.clicks,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          last_accessed_at = EXCLUDED.last_accessed_at,
          expires_at = EXCLUDED.expires_at,
          recent_visits = EXCLUDED.recent_visits
      `,
      [
        record.code,
        record.originalUrl,
        record.shortUrl,
        record.customAlias,
        record.clicks,
        record.createdAt,
        record.updatedAt,
        record.lastAccessedAt,
        record.expiresAt,
        record.recentVisits,
      ],
    );
  }

  async delete(code: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM short_urls WHERE code = $1",
      [code],
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }
}
