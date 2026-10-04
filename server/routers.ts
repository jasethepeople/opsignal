import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAction, createIntegration, createPlaybook, createSignal, createTeamMember, getDashboard, updateActionStatus, updateIntegrationStatus, updatePlaybookStatus, updateSignalStatus, updateWorkspaceSettings } from "./db";
import { createCheckoutSession, PLAN_CATALOG } from "./billing";

const priority = z.enum(["low", "medium", "high", "critical"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  opsignal: router({
    dashboard: protectedProcedure.query(({ ctx }) => getDashboard(ctx.user.id, ctx.user.name || "You", ctx.user.email)),
    updateSignal: protectedProcedure
      .input(z.object({ signalId: z.number().int().positive(), status: z.enum(["new", "triaged", "closed"]) }))
      .mutation(({ ctx, input }) => updateSignalStatus(ctx.user.id, ctx.user.name || "You", input.signalId, input.status)),
    updateAction: protectedProcedure
      .input(z.object({ actionId: z.number().int().positive(), status: z.enum(["open", "in_progress", "done", "dismissed"]) }))
      .mutation(({ ctx, input }) => updateActionStatus(ctx.user.id, ctx.user.name || "You", input.actionId, input.status)),
    createAction: protectedProcedure
      .input(z.object({ title: z.string().min(3).max(180), description: z.string().min(3).max(500), ownerName: z.string().min(1).max(120), priority, dueAt: z.coerce.date().nullable().optional() }))
      .mutation(({ ctx, input }) => createAction(ctx.user.id, ctx.user.name || "You", input)),
    createPlaybook: protectedProcedure
      .input(z.object({ name: z.string().min(3).max(160), trigger: z.string().min(3).max(400), ownerName: z.string().min(1).max(120), priority, nextStep: z.string().min(3).max(500) }))
      .mutation(({ ctx, input }) => createPlaybook(ctx.user.id, ctx.user.name || "You", input)),
    updatePlaybook: protectedProcedure
      .input(z.object({ playbookId: z.number().int().positive(), status: z.enum(["active", "draft", "archived"]) }))
      .mutation(({ ctx, input }) => updatePlaybookStatus(ctx.user.id, ctx.user.name || "You", input.playbookId, input.status)),
    createSignal: protectedProcedure
      .input(z.object({ title: z.string().min(3).max(240), source: z.string().min(2).max(80), sourceType: z.string().min(2).max(80), severity: z.enum(["low", "medium", "high", "critical"]), summary: z.string().min(3).max(500), impact: z.string().min(3).max(500) }))
      .mutation(({ ctx, input }) => createSignal(ctx.user.id, ctx.user.name || "You", input)),
    createIntegration: protectedProcedure
      .input(z.object({ name: z.string().min(2).max(120), category: z.string().min(2).max(80), description: z.string().min(3).max(500) }))
      .mutation(({ ctx, input }) => createIntegration(ctx.user.id, ctx.user.name || "You", input)),
    updateIntegration: protectedProcedure
      .input(z.object({ integrationId: z.number().int().positive(), status: z.enum(["attention", "available"]) }))
      .mutation(({ ctx, input }) => updateIntegrationStatus(ctx.user.id, ctx.user.name || "You", input.integrationId, input.status)),
    inviteMember: protectedProcedure
      .input(z.object({ name: z.string().min(2).max(120), email: z.string().email().max(320), role: z.string().min(2).max(120), scope: z.string().min(2).max(160) }))
      .mutation(({ ctx, input }) => createTeamMember(ctx.user.id, ctx.user.name || "You", input)),
    updateWorkspaceSettings: protectedProcedure
      .input(z.object({ name: z.string().min(2).max(120), timezone: z.string().min(2).max(80) }))
      .mutation(({ ctx, input }) => updateWorkspaceSettings(ctx.user.id, ctx.user.name || "You", input)),
    billing: router({
      catalog: publicProcedure.query(() => PLAN_CATALOG),
      checkout: protectedProcedure
        .input(z.object({ plan: z.enum(["pro", "team"]), origin: z.string().url() }))
        .mutation(({ ctx, input }) => createCheckoutSession({ userId: ctx.user.id, name: ctx.user.name || "Operator", email: ctx.user.email, plan: input.plan, origin: input.origin })),
    }),
  }),
});

export type AppRouter = typeof appRouter;
