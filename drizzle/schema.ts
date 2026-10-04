import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  timezone: varchar("timezone", { length: 80 }).default("America/Denver").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  title: text("title").notNull(),
  source: varchar("source", { length: 80 }).notNull(),
  sourceType: varchar("sourceType", { length: 80 }).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["new", "triaged", "closed"]).default("new").notNull(),
  summary: text("summary").notNull(),
  impact: text("impact").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const actions = mysqlTable("actions", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  signalId: int("signalId"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ownerName: varchar("ownerName", { length: 120 }).notNull(),
  ownerEmail: varchar("ownerEmail", { length: 320 }),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "done", "dismissed"]).default("open").notNull(),
  dueAt: timestamp("dueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["connected", "attention", "available"]).default("available").notNull(),
  description: text("description").notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  recordsSynced: int("recordsSynced").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const playbooks = mysqlTable("playbooks", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  trigger: text("trigger").notNull(),
  ownerName: varchar("ownerName", { length: 120 }).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  nextStep: text("nextStep").notNull(),
  status: mysqlEnum("status", ["active", "draft", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }),
  role: varchar("role", { length: 120 }).notNull(),
  scope: varchar("scope", { length: 160 }).notNull(),
  avatarColor: varchar("avatarColor", { length: 20 }).default("#a9e8d5").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  actorName: varchar("actorName", { length: 120 }).notNull(),
  action: varchar("action", { length: 160 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId"),
  context: text("context").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Signal = typeof signals.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type Playbook = typeof playbooks.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
