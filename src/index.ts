import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { config } from "./config";
import { createUrlCache } from "./cache/createUrlCache";
import { AnalyticsFlushService } from "./services/AnalyticsFlushService";
import { AnalyticsIngestService } from "./services/AnalyticsIngestService";
import { createUrlRepository } from "./store/createUrlRepository";
import { UrlService } from "./services/UrlService";

async function main(): Promise<void> {
  const app = express();
  const repository = createUrlRepository();
  await repository.connect();
  const cache = createUrlCache();
  await cache.connect();
  const analyticsIngestService = new AnalyticsIngestService(cache, config.analyticsIngestIntervalMs);
  const urlService = new UrlService(repository, cache, analyticsIngestService);
  const analyticsFlushService = new AnalyticsFlushService(
    repository,
    cache,
    config.analyticsFlushIntervalMs,
  );
  const publicDirectory = path.resolve(process.cwd(), "public");

  app.use(express.json());
  app.use(express.static(publicDirectory));

function getBaseUrl(request: Request): string {
  if (config.baseUrl) {
    return config.baseUrl;
  }

  return `${request.protocol}://${request.get("host")}`;
}

function getRouteCode(request: Request): string {
  const value = request.params.code;
  return Array.isArray(value) ? value[0] : value;
}

  app.get("/api", async (_request: Request, response: Response) => {
    response.json({
      service: "url-shortener",
      status: "ok",
      storage: config.storageMode,
      cache: {
        mode: cache.kind,
        analyticsIngestIntervalMs: config.analyticsIngestIntervalMs,
        analyticsFlushIntervalMs: config.analyticsFlushIntervalMs,
      },
      endpoints: {
        health: "GET /health",
        create: "POST /api/urls",
        list: "GET /api/urls",
        detail: "GET /api/urls/:code",
        stats: "GET /api/urls/:code/stats",
        remove: "DELETE /api/urls/:code",
        redirect: "GET /:code",
      },
    });
  });

  app.get("/", async (_request: Request, response: Response) => {
    response.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.get("/health", async (_request: Request, response: Response) => {
    response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      storage: config.storageMode,
      cache: cache.kind,
    });
  });

  app.post("/api/urls", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await urlService.createShortUrl(
        {
          originalUrl: request.body?.url,
          customAlias: request.body?.customAlias,
          expiresAt: request.body?.expiresAt,
        },
        getBaseUrl(request),
      );

      response.status(result.created ? 201 : 200).json({
        message: result.created ? "Short URL created successfully." : "Existing short URL returned.",
        data: result.record,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/urls", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const records = await urlService.getAll(getBaseUrl(request));
      response.json({
        total: records.length,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/urls/:code", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const record = await urlService.getByCode(getRouteCode(request), getBaseUrl(request));

      if (!record) {
        response.status(404).json({ message: "Short URL not found." });
        return;
      }

      response.json({ data: record });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/urls/:code/stats", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const record = await urlService.getByCode(getRouteCode(request), getBaseUrl(request));

      if (!record) {
        response.status(404).json({ message: "Short URL not found." });
        return;
      }

      response.json({
        data: {
          code: record.code,
          originalUrl: record.originalUrl,
          shortUrl: record.shortUrl,
          clicks: record.clicks,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          lastAccessedAt: record.lastAccessedAt,
          expiresAt: record.expiresAt,
          recentVisits: record.recentVisits,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/urls/:code", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const deleted = await urlService.delete(getRouteCode(request));

      if (!deleted) {
        response.status(404).json({ message: "Short URL not found." });
        return;
      }

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/:code", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const record = await urlService.resolve(getRouteCode(request), getBaseUrl(request));

      if (!record) {
        response.status(404).json({ message: "Short URL not found or expired." });
        return;
      }

      response.redirect(record.originalUrl);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(400).json({ message });
  });

  analyticsFlushService.start();
  analyticsIngestService.start();

  const shutdown = async () => {
    await analyticsIngestService.stop();
    await analyticsFlushService.stop();
    await cache.disconnect();
    await repository.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  app.listen(config.port, () => {
    console.log(
      `URL shortener listening on http://localhost:${config.port} using ${config.storageMode} storage and ${cache.kind} cache`,
    );
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Startup failure.";
  console.error(message);
  process.exit(1);
});
