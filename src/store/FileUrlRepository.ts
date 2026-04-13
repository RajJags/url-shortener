import fs from "fs/promises";
import path from "path";
import { UrlRecord, UrlRepository } from "../types";

interface FileShape {
  urls: UrlRecord[];
}

export class FileUrlRepository implements UrlRepository {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async connect(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async getAll(): Promise<UrlRecord[]> {
    const data = await this.readData();
    return [...data.urls].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getByCode(code: string): Promise<UrlRecord | null> {
    const data = await this.readData();
    return data.urls.find((record) => record.code === code) ?? null;
  }

  async getByOriginalUrl(originalUrl: string): Promise<UrlRecord | null> {
    const data = await this.readData();
    return data.urls.find(
      (record) =>
        record.originalUrl === originalUrl &&
        !record.customAlias &&
        !this.isExpired(record),
    ) ?? null;
  }

  async save(record: UrlRecord): Promise<void> {
    const data = await this.readData();
    const existingIndex = data.urls.findIndex((item) => item.code === record.code);

    if (existingIndex >= 0) {
      data.urls[existingIndex] = record;
    } else {
      data.urls.push(record);
    }

    await this.writeData(data);
  }

  async delete(code: string): Promise<boolean> {
    const data = await this.readData();
    const nextUrls = data.urls.filter((record) => record.code !== code);
    const deleted = nextUrls.length !== data.urls.length;

    if (deleted) {
      await this.writeData({ urls: nextUrls });
    }

    return deleted;
  }

  private async readData(): Promise<FileShape> {
    await this.connect();

    try {
      const file = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(file) as FileShape;

      if (!Array.isArray(parsed.urls)) {
        return { urls: [] };
      }

      return parsed;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === "ENOENT") {
        const emptyState = { urls: [] };
        await this.writeData(emptyState);
        return emptyState;
      }

      throw error;
    }
  }

  private async writeData(data: FileShape): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  private isExpired(record: UrlRecord): boolean {
    return Boolean(record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now());
  }
}
