import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAction, createPlaybook, getDashboard, updateActionStatus, updatePlaybookStatus, updateSignalStatus } from "./db";

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
  }),
});

export type AppRouter = typeof appRouter;
