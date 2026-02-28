import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// ============================================================
// Users (synced from Clerk via webhook)
// ============================================================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Data Source Connections (Procore / Sage credentials per org)
// ============================================================
export const dataConnections = pgTable("data_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'procore' | 'sage_intacct'
  name: varchar("name", { length: 255 }).notNull(),

  // Encrypted credentials stored as JSON
  // Procore: { accessToken, refreshToken, companyId, expiresAt }
  // Sage: { senderId, senderPassword, companyId, userId, userPassword }
  credentials: jsonb("credentials"),

  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Synced data cache (avoid hitting external APIs on every page load)
// ============================================================
export const syncedProjects = pgTable("synced_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id")
    .references(() => dataConnections.id)
    .notNull(),
  externalId: varchar("external_id", { length: 255 }).notNull(), // Procore project ID or Sage project ID
  source: varchar("source", { length: 50 }).notNull(), // 'procore' | 'sage_intacct'
  data: jsonb("data").notNull(), // Full API response cached
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

// ============================================================
// Internal Projects (user-managed workspace projects)
// ============================================================
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Uploaded Datasets (user CSV/XLSX uploads for AI chat analysis)
// ============================================================
export const uploadedDatasets = pgTable("uploaded_datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  category: varchar("category", { length: 50 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  sheets: jsonb("sheets").notNull(),
  meta: jsonb("meta"),
  isActive: boolean("is_active").default(true).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// ============================================================
// Custom Dashboards (user-created dashboards per project)
// ============================================================
export const customDashboards = pgTable("custom_dashboards", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Dashboard Widgets (chart/KPI configuration per dashboard)
// ============================================================
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  dashboardId: uuid("dashboard_id")
    .references(() => customDashboards.id)
    .notNull(),
  widgetType: varchar("widget_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  config: jsonb("config").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
