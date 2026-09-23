import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { z } from "zod/v4";
import { visitorCategories } from "./webspecs";

export const sqliteWebspecsEvents = sqliteTable("webspecs_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  receivedAt: text("received_at").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  headers: text("headers", { mode: "json" }).$type<Record<string, string | string[] | undefined>>().notNull(),
  isStaticAsset: integer("is_static_asset", { mode: "boolean" }).notNull().default(false),
  classification: text("classification", { enum: visitorCategories }).notNull(),
  classificationReason: text("classification_reason").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  datacenterProvider: text("datacenter_provider"),
  jsExecuted: integer("js_executed", { mode: "boolean" }),
  webdriver: integer("webdriver", { mode: "boolean" }),
  mouseMoved: integer("mouse_moved", { mode: "boolean" }),
  scrolled: integer("scrolled", { mode: "boolean" }),
  touched: integer("touched", { mode: "boolean" }),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  navigationTimingMs: integer("navigation_timing_ms"),
  jsReceivedAt: text("js_received_at"),
});

export const sqliteWebspecsRollups = sqliteTable(
  "webspecs_rollups",
  {
    bucketStart: text("bucket_start").notNull(),
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

export const insertSqliteWebSpecsEventSchema = createInsertSchema(sqliteWebspecsEvents);
export const insertSqliteWebSpecsRollupSchema = createInsertSchema(sqliteWebspecsRollups);
export const sqliteVisitorCategorySchema = z.enum(visitorCategories);
export type SqliteWebSpecsEvent = typeof sqliteWebspecsEvents.$inferSelect;
export type InsertSqliteWebSpecsEvent = z.infer<typeof insertSqliteWebSpecsEventSchema>;