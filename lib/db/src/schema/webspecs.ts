import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const visitorCategories = [
  "human",
  "training_crawler",
  "agent_fetch",
  "unidentified_bot",
  "suspicious_spoofed",
] as const;

export const webspecsEvents = pgTable("webspecs_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  headers: jsonb("headers").$type<Record<string, string | string[] | undefined>>().notNull(),
  isStaticAsset: boolean("is_static_asset").notNull().default(false),
  classification: text("classification", { enum: visitorCategories }).notNull(),
  classificationReason: text("classification_reason").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  datacenterProvider: text("datacenter_provider"),
  jsExecuted: boolean("js_executed"),
  webdriver: boolean("webdriver"),
  mouseMoved: boolean("mouse_moved"),
  scrolled: boolean("scrolled"),
  touched: boolean("touched"),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  navigationTimingMs: integer("navigation_timing_ms"),
  jsReceivedAt: timestamp("js_received_at", { withTimezone: true }),
});

export const webspecsRollups = pgTable(
  "webspecs_rollups",
  {
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    category: text("category", { enum: visitorCategories }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    pageCount: integer("page_count").notNull().default(0),
    jsSignalCount: integer("js_signal_count").notNull().default(0),
  },
  (table) => ({
    bucketCategoryPk: primaryKey({
      columns: [table.bucketStart, table.category],
    }),
  }),
);

export const insertWebSpecsEventSchema = createInsertSchema(webspecsEvents);
export const insertWebSpecsRollupSchema = createInsertSchema(webspecsRollups);
export const visitorCategorySchema = z.enum(visitorCategories);
export type WebSpecsEvent = typeof webspecsEvents.$inferSelect;
export type InsertWebSpecsEvent = z.infer<typeof insertWebSpecsEventSchema>;
export type WebSpecsRollup = typeof webspecsRollups.$inferSelect;
export type InsertWebSpecsRollup = z.infer<typeof insertWebSpecsRollupSchema>;