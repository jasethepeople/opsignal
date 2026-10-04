import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { billingHistory, stripeEvents, subscriptions, workspaces } from "../drizzle/schema";
import { getDb } from "./db";

export const PLAN_CATALOG = {
  pro: { name: "Opsignal Pro", amount: 4900, label: "$49 / month", description: "Unlimited operating context for a focused team." },
  team: { name: "Opsignal Team", amount: 14900, label: "$149 / month", description: "Shared ownership, controls, and room to scale." },
} as const;

export type PaidPlan = keyof typeof PLAN_CATALOG;

type StripeCheckoutSession = {
  id?: string;
  url?: string;
  customer?: string | null;
  subscription?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string>;
};

type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data: { object: Record<string, unknown> };
};

function requireStripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Billing is not configured yet. Enable Stripe for this workspace first.");
  return secret;
}

function unixToDate(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function toPlan(value: unknown): PaidPlan | "free" {
  return value === "team" || value === "pro" ? value : "free";
}

export async function createCheckoutSession(input: { userId: number; name: string; email?: string | null; plan: PaidPlan; origin: string }) {
  const secret = requireStripeSecret();
  const catalog = PLAN_CATALOG[input.plan];
  const origin = input.origin.replace(/\/$/, "");
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", `${origin}/?billing=success&plan=${input.plan}`);
  body.set("cancel_url", `${origin}/?billing=canceled`);
  body.set("allow_promotion_codes", "true");
  body.set("client_reference_id", String(input.userId));
  body.set("customer_email", input.email || "");
  body.set("metadata[user_id]", String(input.userId));
  body.set("metadata[plan]", input.plan);
  body.set("metadata[customer_name]", input.name);
  body.set("subscription_data[metadata][user_id]", String(input.userId));
  body.set("subscription_data[metadata][plan]", input.plan);
  body.set("subscription_data[metadata][customer_name]", input.name);
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(catalog.amount));
  body.set("line_items[0][price_data][recurring][interval]", "month");
  body.set("line_items[0][price_data][product_data][name]", catalog.name);
  body.set("line_items[0][price_data][product_data][description]", catalog.description);
  body.set("line_items[0][quantity]", "1");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) throw new Error(payload.error?.message || "Stripe could not create checkout.");
  return { url: payload.url };
}

function verifyStripeSignature(rawBody: Buffer, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const timestamp = signature.match(/(?:^|,)t=(\d+)/)?.[1];
  const received = signature.match(/(?:^|,)v1=([a-f0-9]+)/)?.[1];
  if (!timestamp || !received) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

async function setSubscription(workspaceId: number, values: { plan: "free" | "pro" | "team"; status: "active" | "trialing" | "past_due" | "canceled"; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; currentPeriodEnd?: Date | null; cancelAtPeriodEnd?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(subscriptions).values({ workspaceId, ...values }).onDuplicateKeyUpdate({ set: values });
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe webhook signing is not configured.");
  if (!verifyStripeSignature(rawBody, signature, secret)) throw new Error("Invalid Stripe webhook signature.");
  const event = JSON.parse(rawBody.toString("utf8")) as StripeEvent;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const alreadyProcessed = await db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.eventId, event.id)).limit(1);
  if (alreadyProcessed[0]) return { duplicate: true };

  const object = event.data.object;
  let workspaceId: number | null = null;
  const metadata = (object.metadata || {}) as Record<string, string>;
  const userId = Number(metadata.user_id || (object.client_reference_id as string | undefined) || 0);
  if (userId) {
    const workspace = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerId, userId)).limit(1);
    workspaceId = workspace[0]?.id ?? null;
  }

  const subscriptionId = typeof object.subscription === "string" ? object.subscription : typeof object.id === "string" && event.type.startsWith("customer.subscription") ? object.id : null;
  const customerId = typeof object.customer === "string" ? object.customer : null;
  const plan = toPlan(metadata.plan || (object.metadata as Record<string, string> | undefined)?.plan);
  const status = event.type === "customer.subscription.deleted" ? "canceled" : (object.status === "past_due" ? "past_due" : event.type.startsWith("customer.subscription") ? "active" : "active");

  if (workspaceId && (event.type === "checkout.session.completed" || event.type.startsWith("customer.subscription"))) {
    await setSubscription(workspaceId, {
      plan: plan === "free" ? "pro" : plan,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: unixToDate(object.current_period_end),
      cancelAtPeriodEnd: object.cancel_at_period_end ? 1 : 0,
    });
    if (event.type === "checkout.session.completed") {
      await db.insert(billingHistory).values({
        workspaceId,
        kind: "subscription_started",
        plan: plan === "free" ? "pro" : plan,
        amount: typeof object.amount_total === "number" ? object.amount_total : PLAN_CATALOG[plan === "free" ? "pro" : plan].amount,
        currency: typeof object.currency === "string" ? object.currency : "usd",
        status: "paid",
        stripeCheckoutSessionId: typeof object.id === "string" ? object.id : null,
        stripeInvoiceId: null,
      });
    }
  }

  await db.insert(stripeEvents).values({ eventId: event.id, eventType: event.type, workspaceId, processedAt: new Date() });
  return { duplicate: false };
}
