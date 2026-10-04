import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  actions,
  auditEvents,
  integrations,
  InsertUser,
  playbooks,
  signals,
  teamMembers,
  users,
  workspaces,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = new Date();
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function addAudit(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, workspaceId: number, actorName: string, action: string, entityType: string, entityId: number | null, context: string) {
  await db.insert(auditEvents).values({ workspaceId, actorName, action, entityType, entityId, context });
}

const seedSignals = [
  {
    title: "Checkout conversion dropped 18% in the last 24 hours",
    source: "PostHog",
    sourceType: "Product analytics",
    severity: "critical" as const,
    summary: "The payment step is losing more users than its 30-day baseline.",
    impact: "Estimated $12.4k in weekly pipeline at risk if the trend holds.",
    occurredAt: new Date(Date.now() - 1000 * 60 * 42),
  },
  {
    title: "Enterprise onboarding call has no owner",
    source: "Calendly",
    sourceType: "Calendar",
    severity: "high" as const,
    summary: "A strategic account booked an onboarding call for tomorrow morning.",
    impact: "No assigned operator means the meeting may arrive without context or a success plan.",
    occurredAt: new Date(Date.now() - 1000 * 60 * 96),
  },
  {
    title: "Stripe webhook retries are accumulating",
    source: "Stripe",
    sourceType: "Billing",
    severity: "high" as const,
    summary: "13 invoice events have retried at least twice since the last deploy.",
    impact: "Revenue reporting and customer entitlements may drift from the source of truth.",
    occurredAt: new Date(Date.now() - 1000 * 60 * 143),
  },
  {
    title: "New high-fit prospects entered the funnel",
    source: "Apollo",
    sourceType: "Revenue",
    severity: "medium" as const,
    summary: "Eight accounts match the current ICP and have active buying signals.",
    impact: "Fast, personal follow-up could convert the research window into qualified pipeline.",
    occurredAt: new Date(Date.now() - 1000 * 60 * 235),
  },
  {
    title: "Weekly operating review is ready to run",
    source: "Opsignal",
    sourceType: "System",
    severity: "low" as const,
    summary: "The workspace has enough fresh data to review yesterday's operating rhythm.",
    impact: "A 15-minute review can clear four stale items before they become escalations.",
    occurredAt: new Date(Date.now() - 1000 * 60 * 311),
  },
];

async function repairWorkspaceData(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, workspaceId: number, actorName: string, actorEmail?: string | null) {
  const [memberRows, signalRows, integrationRows, playbookRows, auditRows] = await Promise.all([
    db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.workspaceId, workspaceId)).limit(1),
    db.select({ id: signals.id }).from(signals).where(eq(signals.workspaceId, workspaceId)).limit(1),
    db.select({ id: integrations.id }).from(integrations).where(eq(integrations.workspaceId, workspaceId)).limit(1),
    db.select({ id: playbooks.id }).from(playbooks).where(eq(playbooks.workspaceId, workspaceId)).limit(1),
    db.select({ id: auditEvents.id }).from(auditEvents).where(eq(auditEvents.workspaceId, workspaceId)).limit(1),
  ]);

  if (!memberRows.length) {
    await db.insert(teamMembers).values([
      { workspaceId, name: actorName || "You", email: actorEmail ?? null, role: "Operations lead", scope: "Workspace ownership", avatarColor: "#9be5cb" },
      { workspaceId, name: "Maya Chen", email: "maya@northstar.example", role: "Customer success", scope: "Onboarding + retention", avatarColor: "#f6c98d" },
      { workspaceId, name: "Jordan Bell", email: "jordan@northstar.example", role: "Revenue operations", scope: "Pipeline + billing", avatarColor: "#c4b5fd" },
      { workspaceId, name: "Ari Williams", email: "ari@northstar.example", role: "Product", scope: "Activation + experiments", avatarColor: "#f4a7b9" },
    ]);
  }
  if (!signalRows.length) await db.insert(signals).values(seedSignals.map(signal => ({ workspaceId, ...signal })));
  if (!integrationRows.length) {
    await db.insert(integrations).values([
      { workspaceId, name: "PostHog", category: "Product analytics", status: "connected" as const, description: "Activation, funnel and behavior signals", lastSyncAt: new Date(Date.now() - 1000 * 60 * 6), recordsSynced: 18420 },
      { workspaceId, name: "Stripe", category: "Billing", status: "attention" as const, description: "Payments, invoices and entitlement changes", lastSyncAt: new Date(Date.now() - 1000 * 60 * 27), recordsSynced: 3481 },
      { workspaceId, name: "Calendly", category: "Scheduling", status: "connected" as const, description: "Meetings, handoffs and no-show risk", lastSyncAt: new Date(Date.now() - 1000 * 60 * 13), recordsSynced: 928 },
      { workspaceId, name: "Apollo", category: "Revenue", status: "available" as const, description: "Prospects, accounts and buying signals", lastSyncAt: null, recordsSynced: 0 },
      { workspaceId, name: "Linear", category: "Delivery", status: "available" as const, description: "Issues, projects and engineering ownership", lastSyncAt: null, recordsSynced: 0 },
      { workspaceId, name: "Jotform", category: "Intake", status: "available" as const, description: "Operational requests and structured intake", lastSyncAt: null, recordsSynced: 0 },
    ]);
  }
  if (!playbookRows.length) {
    await db.insert(playbooks).values([
      { workspaceId, name: "Payment friction response", trigger: "Checkout conversion falls >10% week over week", ownerName: "Ari Williams", priority: "critical" as const, nextStep: "Inspect the payment funnel and open a contained incident within 30 minutes.", status: "active" as const },
      { workspaceId, name: "Enterprise handoff", trigger: "A strategic account books an onboarding call", ownerName: "Maya Chen", priority: "high" as const, nextStep: "Create a one-page account brief and confirm the success owner before the call.", status: "active" as const },
      { workspaceId, name: "Stale action sweep", trigger: "An action is overdue by more than 48 hours", ownerName: actorName || "You", priority: "medium" as const, nextStep: "Reassign, rescope, or close the action and capture the reason.", status: "draft" as const },
    ]);
  }
  if (!auditRows.length) await addAudit(db, workspaceId, actorName || "System", "repaired workspace bootstrap", "workspace", workspaceId, "Restored missing starter context without changing existing actions.");
}

async function ensureWorkspace(userId: number, actorName: string, actorEmail?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(workspaces).where(eq(workspaces.ownerId, userId)).limit(1);
  if (existing[0]) {
    await repairWorkspaceData(db, existing[0].id, actorName, actorEmail);
    return existing[0];
  }

  const workspaceResult = await db.insert(workspaces).values({
    ownerId: userId,
    name: "Northstar Operations",
    slug: `northstar-${userId}`,
    timezone: "America/Denver",
  });
  const workspaceId = Number((workspaceResult as unknown as { insertId: number }).insertId);
  await db.insert(teamMembers).values([
    { workspaceId, name: actorName || "You", email: actorEmail ?? null, role: "Operations lead", scope: "Workspace ownership", avatarColor: "#9be5cb" },
    { workspaceId, name: "Maya Chen", email: "maya@northstar.example", role: "Customer success", scope: "Onboarding + retention", avatarColor: "#f6c98d" },
    { workspaceId, name: "Jordan Bell", email: "jordan@northstar.example", role: "Revenue operations", scope: "Pipeline + billing", avatarColor: "#c4b5fd" },
    { workspaceId, name: "Ari Williams", email: "ari@northstar.example", role: "Product", scope: "Activation + experiments", avatarColor: "#f4a7b9" },
  ]);
  await db.insert(signals).values(seedSignals.map(signal => ({ workspaceId, ...signal })));
  await db.insert(integrations).values([
    { workspaceId, name: "PostHog", category: "Product analytics", status: "connected" as const, description: "Activation, funnel and behavior signals", lastSyncAt: new Date(Date.now() - 1000 * 60 * 6), recordsSynced: 18420 },
    { workspaceId, name: "Stripe", category: "Billing", status: "attention" as const, description: "Payments, invoices and entitlement changes", lastSyncAt: new Date(Date.now() - 1000 * 60 * 27), recordsSynced: 3481 },
    { workspaceId, name: "Calendly", category: "Scheduling", status: "connected" as const, description: "Meetings, handoffs and no-show risk", lastSyncAt: new Date(Date.now() - 1000 * 60 * 13), recordsSynced: 928 },
    { workspaceId, name: "Apollo", category: "Revenue", status: "available" as const, description: "Prospects, accounts and buying signals", lastSyncAt: null, recordsSynced: 0 },
    { workspaceId, name: "Linear", category: "Delivery", status: "available" as const, description: "Issues, projects and engineering ownership", lastSyncAt: null, recordsSynced: 0 },
    { workspaceId, name: "Jotform", category: "Intake", status: "available" as const, description: "Operational requests and structured intake", lastSyncAt: null, recordsSynced: 0 },
  ]);
  await db.insert(playbooks).values([
    { workspaceId, name: "Payment friction response", trigger: "Checkout conversion falls >10% week over week", ownerName: "Ari Williams", priority: "critical" as const, nextStep: "Inspect the payment funnel and open a contained incident within 30 minutes.", status: "active" as const },
    { workspaceId, name: "Enterprise handoff", trigger: "A strategic account books an onboarding call", ownerName: "Maya Chen", priority: "high" as const, nextStep: "Create a one-page account brief and confirm the success owner before the call.", status: "active" as const },
    { workspaceId, name: "Stale action sweep", trigger: "An action is overdue by more than 48 hours", ownerName: actorName || "You", priority: "medium" as const, nextStep: "Reassign, rescope, or close the action and capture the reason.", status: "draft" as const },
  ]);

  const createdActions = await db.insert(actions).values([
    { workspaceId, signalId: 1, title: "Reproduce checkout drop on production", description: "Compare the payment-step funnel across browser, plan and country segments.", ownerName: "Ari Williams", ownerEmail: "ari@northstar.example", priority: "critical" as const, status: "in_progress" as const, dueAt: new Date(Date.now() + 1000 * 60 * 60 * 3) },
    { workspaceId, signalId: 2, title: "Assign onboarding owner and prep brief", description: "Confirm the account owner, pull recent context and add a success outcome to the invite.", ownerName: "Maya Chen", ownerEmail: "maya@northstar.example", priority: "high" as const, status: "open" as const, dueAt: new Date(Date.now() + 1000 * 60 * 60 * 18) },
    { workspaceId, signalId: 3, title: "Review failed invoice webhook payloads", description: "Trace the retrying event types and verify entitlement state before the next billing run.", ownerName: "Jordan Bell", ownerEmail: "jordan@northstar.example", priority: "high" as const, status: "open" as const, dueAt: new Date(Date.now() + 1000 * 60 * 60 * 8) },
    { workspaceId, signalId: 4, title: "Draft first-touch sequence for high-fit accounts", description: "Turn the eight new prospects into a short, personalized outreach batch.", ownerName: actorName || "You", ownerEmail: actorEmail ?? null, priority: "medium" as const, status: "open" as const, dueAt: new Date(Date.now() + 1000 * 60 * 60 * 26) },
    { workspaceId, signalId: 5, title: "Run the 15-minute operating review", description: "Clear stale items and capture one decision for the weekly team sync.", ownerName: actorName || "You", ownerEmail: actorEmail ?? null, priority: "low" as const, status: "done" as const, dueAt: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  ]);
  await addAudit(db, workspaceId, actorName || "System", "created workspace", "workspace", workspaceId, "Seeded the first operating context for a new workspace.");
  return { id: workspaceId, name: "Northstar Operations", slug: `northstar-${userId}`, timezone: "America/Denver", createdAt: new Date(), updatedAt: new Date() };
}

export async function getDashboard(userId: number, actorName: string, actorEmail?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const workspace = await ensureWorkspace(userId, actorName, actorEmail);
  const [signalRows, actionRows, integrationRows, playbookRows, memberRows, auditRows] = await Promise.all([
    db.select().from(signals).where(eq(signals.workspaceId, workspace.id)).orderBy(desc(signals.occurredAt)),
    db.select().from(actions).where(eq(actions.workspaceId, workspace.id)).orderBy(desc(actions.createdAt)),
    db.select().from(integrations).where(eq(integrations.workspaceId, workspace.id)).orderBy(desc(integrations.updatedAt)),
    db.select().from(playbooks).where(eq(playbooks.workspaceId, workspace.id)).orderBy(desc(playbooks.updatedAt)),
    db.select().from(teamMembers).where(eq(teamMembers.workspaceId, workspace.id)).orderBy(teamMembers.name),
    db.select().from(auditEvents).where(eq(auditEvents.workspaceId, workspace.id)).orderBy(desc(auditEvents.createdAt)).limit(12),
  ]);
  const openActions = actionRows.filter(item => item.status === "open" || item.status === "in_progress");
  const urgentSignals = signalRows.filter(item => item.severity === "critical" || item.severity === "high").filter(item => item.status !== "closed");
  const overdueActions = openActions.filter(item => item.dueAt && item.dueAt.getTime() < Date.now());
  const connected = integrationRows.filter(item => item.status === "connected").length;
  return {
    workspace,
    signals: signalRows,
    actions: actionRows,
    integrations: integrationRows,
    playbooks: playbookRows,
    teamMembers: memberRows,
    auditEvents: auditRows,
    metrics: {
      urgentSignals: urgentSignals.length,
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      connectedIntegrations: connected,
      totalIntegrations: integrationRows.length,
      signalVolume: signalRows.length,
    },
  };
}

export async function updateSignalStatus(userId: number, actorName: string, signalId: number, status: "new" | "triaged" | "closed") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const workspace = await ensureWorkspace(userId, actorName);
  const signal = await db.select().from(signals).where(and(eq(signals.id, signalId), eq(signals.workspaceId, workspace.id))).limit(1);
  if (!signal[0]) throw new Error("Signal not found");
  await db.update(signals).set({ status }).where(eq(signals.id, signalId));
  await addAudit(db, workspace.id, actorName, `marked signal ${status}`, "signal", signalId, signal[0].title);
  return { ok: true };
}

export async function updateActionStatus(userId: number, actorName: string, actionId: number, status: "open" | "in_progress" | "done" | "dismissed") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const workspace = await ensureWorkspace(userId, actorName);
  const action = await db.select().from(actions).where(and(eq(actions.id, actionId), eq(actions.workspaceId, workspace.id))).limit(1);
  if (!action[0]) throw new Error("Action not found");
  await db.update(actions).set({ status }).where(eq(actions.id, actionId));
  await addAudit(db, workspace.id, actorName, `updated action to ${status}`, "action", actionId, action[0].title);
  return { ok: true };
}

export async function createAction(userId: number, actorName: string, input: { title: string; description: string; ownerName: string; priority: "low" | "medium" | "high" | "critical"; dueAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const workspace = await ensureWorkspace(userId, actorName);
  const result = await db.insert(actions).values({ workspaceId: workspace.id, ...input, ownerEmail: null, dueAt: input.dueAt ?? null, status: "open" as const });
  const actionId = Number((result as unknown as { insertId: number }).insertId);
  await addAudit(db, workspace.id, actorName, "created action", "action", actionId, input.title);
  return { ok: true, id: actionId };
}

export async function createPlaybook(userId: number, actorName: string, input: { name: string; trigger: string; ownerName: string; priority: "low" | "medium" | "high" | "critical"; nextStep: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const workspace = await ensureWorkspace(userId, actorName);
  const result = await db.insert(playbooks).values({ workspaceId: workspace.id, ...input, status: "draft" as const });
  const playbookId = Number((result as unknown as { insertId: number }).insertId);
  await addAudit(db, workspace.id, actorName, "created playbook", "playbook", playbookId, input.name);
  return { ok: true, id: playbookId };
}

export async function updatePlaybookStatus(userId: number, actorName: string, playbookId: number, status: "active" | "draft" | "archived") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const workspace = await ensureWorkspace(userId, actorName);
  const playbook = await db.select().from(playbooks).where(and(eq(playbooks.id, playbookId), eq(playbooks.workspaceId, workspace.id))).limit(1);
  if (!playbook[0]) throw new Error("Playbook not found");
  await db.update(playbooks).set({ status }).where(eq(playbooks.id, playbookId));
  await addAudit(db, workspace.id, actorName, `marked playbook ${status}`, "playbook", playbookId, playbook[0].name);
  return { ok: true };
}
