import type { RequestHandler, Request } from "express";
import { randomUUID } from "node:crypto";
import {
  classifyRequest,
  hashIp,
  type ClassificationResult,
  type VisitorCategory,
} from "@workspace/webspecs-classifier";

export interface WebSpecsRequestEvent {
  id: string;
  requestId: string;
  receivedAt: string;
  method: string;
  path: string;
  userAgent: string | null;
  ipHash: string | null;
  headers: Record<string, string | string[] | undefined>;
  isStaticAsset: boolean;
  classification: VisitorCategory;
  classificationReason: string;
  classifierVersion: string;
  datacenterProvider?: string;
}

export interface WebSpecsEventStore {
  insert(event: WebSpecsRequestEvent): Promise<void> | void;
}

export interface WebSpecsMiddlewareOptions {
  store: WebSpecsEventStore;
  hashSalt: string;
  requestIdHeader?: string;
  isStaticAsset?: (request: Request) => boolean;
  idFactory?: () => string;
  onStoreError?: (error: unknown, event: WebSpecsRequestEvent) => void;
}

const staticAssetPattern =
  /\.(?:avif|css|gif|ico|jpe?g|js|mjs|map|png|svg|webp|woff2?|ttf|xml|txt)$/i;

function getRequestIp(request: Request): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim() || null;
  return request.socket.remoteAddress ?? null;
}

function defaultIsStaticAsset(request: Request): boolean {
  return staticAssetPattern.test(request.path);
}

function defaultIdFactory(): string {
  return randomUUID();
}

export function createWebSpecsMiddleware(
  options: WebSpecsMiddlewareOptions,
): RequestHandler {
  const requestIdHeader = options.requestIdHeader ?? "x-webspecs-request-id";
  const isStaticAsset = options.isStaticAsset ?? defaultIsStaticAsset;
  const idFactory = options.idFactory ?? defaultIdFactory;

  return (request, response, next) => {
    const requestId = idFactory();
    const id = idFactory();
    const ip = getRequestIp(request);
    const userAgent = request.get("user-agent") ?? null;
    const pageLoad = !isStaticAsset(request);
    const classification: ClassificationResult = classifyRequest({
      userAgent,
      ip,
      isPageLoad: pageLoad,
    });

    response.setHeader(requestIdHeader, requestId);
    response.locals.webSpecsRequestId = requestId;

    response.on("finish", () => {
      const event: WebSpecsRequestEvent = {
        id,
        requestId,
        receivedAt: new Date().toISOString(),
        method: request.method,
        path: request.path,
        userAgent,
        ipHash: ip ? hashIp(ip, options.hashSalt) : null,
        headers: { ...request.headers },
        isStaticAsset: !pageLoad,
        classification: classification.category,
        classificationReason: classification.reason,
        classifierVersion: classification.classifierVersion,
        datacenterProvider: classification.datacenterProvider,
      };

      void Promise.resolve(options.store.insert(event)).catch((error: unknown) => {
        if (options.onStoreError) {
          options.onStoreError(error, event);
          return;
        }
        throw error;
      });
    });

    next();
  };
}

export type { ClassificationResult, VisitorCategory };