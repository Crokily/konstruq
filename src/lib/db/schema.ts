import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  jsonb,
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
