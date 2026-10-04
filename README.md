# Opsignal

**Opsignal is an operations command center for turning scattered business activity into visible signals, owned actions, repeatable playbooks, and an auditable operating history.**

It is designed for teams that are tired of discovering important changes by checking too many dashboards, inboxes, calendars, and spreadsheets after the moment to act has already passed.

> **Current status:** production-oriented application with authentication, persistent MySQL/Drizzle data, working CRUD flows, Stripe Checkout, signed webhook handling, subscription entitlements, and an operations-focused workspace UI. Stripe is currently configured through the managed sandbox integration until a live Stripe account is claimed.

## Product surface

Opsignal currently includes:

- **Overview:** operating metrics, urgent signals, open actions, overdue work, source coverage, and ownership load.
- **Signal inbox:** search and filter operational signals by severity; triage and close signals; manually capture new signals with source context and impact.
- **Action queue:** create actions, assign owners, set priority and due dates, and move work through open, in-progress, done, and dismissed states.
- **Integrations:** maintain a visible inventory of sources, distinguish connected, attention-needed, and available states, and record setup progress without pretending an unconfigured provider is synced.
- **Playbooks:** turn repeated responses into trigger/owner/priority/next-step operating procedures and activate or pause them.
- **Team ownership:** maintain operators, roles, focus areas, and ownership coverage; record invitations as durable team members.
- **Audit history:** record actor, action, entity, and context for important workspace changes; export the visible audit log as JSON.
- **Workspace settings:** update workspace identity and timezone.
- **Billing & access:** compare Free, Pro, and Team plans, view usage context and billing history, and launch real Stripe subscription checkout.

## Core operating model

Opsignal is organized around a simple loop:

```text
Source activity → Signal → Context and impact → Owned action → Playbook → Audit trail
```

The product is intentionally not just a dashboard. A dashboard tells a team what happened. Opsignal is meant to make the next responsible action explicit and preserve the reasoning trail after the change.

## Architecture

```mermaid
flowchart LR
  A[Authenticated operator] --> UI[React workspace]
  UI --> TRPC[tRPC procedures]
  TRPC --> DB[(MySQL via Drizzle)]
  TRPC --> AUDIT[Audit events]
  UI --> BILLING[Stripe Checkout]
  STRIPE[Stripe] --> WEBHOOK[/api/stripe/webhook/]
  WEBHOOK --> ENTITLEMENTS[Subscription entitlement]
  ENTITLEMENTS --> DB
```

### Technology stack

- **Frontend:** React 19, Vite, TypeScript, Wouter, TanStack React Query, Lucide icons, Sonner toasts.
- **Backend:** Express, tRPC, TypeScript, platform authentication middleware.
- **Persistence:** MySQL through Drizzle ORM and Drizzle Kit migrations.
- **Billing:** Stripe Checkout subscriptions with signed webhook verification and idempotent event storage.
- **Testing:** Vitest plus TypeScript checking and production bundling.
- **Runtime:** Node.js, `tsx` in development, esbuild server bundle in production.

### Repository structure

```text
opsignal/
├── client/
│   ├── public/manus-routes.json   # Managed route manifest
│   └── src/
│       ├── App.tsx                # Product workspace and views
│       └── index.css              # Opsignal visual system
├── drizzle/
│   ├── schema.ts                  # Application data model
│   └── *.sql                      # Checked-in migrations
├── server/
│   ├── _core/                     # Runtime, auth, Vite, health, platform routes
│   ├── billing.ts                 # Stripe Checkout and webhook handling
│   ├── db.ts                      # Queries, bootstrap, mutations, audit logging
│   └── routers.ts                 # Typed protected tRPC API
├── app.config.ts                  # Project metadata
├── package.json                   # Scripts and dependencies
└── README.md
```

## Data model

The current schema contains these primary application tables:

| Table | Purpose |
| --- | --- |
| `users` | Authenticated platform users and sign-in metadata |
| `workspaces` | Workspace identity, owner, slug, and timezone |
| `signals` | Operational changes with source, severity, status, summary, and impact |
| `actions` | Owned work with priority, status, and due date |
| `integrations` | Source inventory and sync/setup state |
| `playbooks` | Reusable trigger-to-next-step operating procedures |
| `teamMembers` | Workspace operators, roles, and focus areas |
| `auditEvents` | Durable workspace change history |
| `subscriptions` | Current workspace plan, Stripe identifiers, status, and renewal state |
| `billingHistory` | Verified subscription billing records |
| `stripeEvents` | Webhook event idempotency and processing history |

Workspace-scoped reads and mutations are protected by the authenticated tRPC context. New workspaces are bootstrapped with operating data and a Free subscription record; the bootstrap path is self-healing for partially initialized workspaces.

## Billing and entitlements

### Plans

| Plan | Price | Positioning |
| --- | ---: | --- |
| Free | `$0` | Core signal → context → action loop |
| Pro | `$49/month` | Unlimited operating context for a focused team |
| Team | `$149/month` | Shared controls and a workspace built for scale |

### Checkout flow

1. An authenticated operator selects Pro or Team in **Workspace settings → Billing & access**.
2. The server creates a Stripe Checkout Session using server-side Stripe credentials.
3. The selected plan and user identity are stored in Checkout and subscription metadata.
4. Stripe redirects the customer to the configured success or cancellation URL.
5. Stripe calls `POST /api/stripe/webhook`.
6. The server verifies the `stripe-signature` against the raw request body.
7. The event is deduplicated through `stripeEvents`.
8. Subscription state and billing history are persisted only after the verified webhook event.

The success URL is not treated as proof of payment. Entitlement changes come from the signed webhook path.

### Live billing readiness

The project uses managed Stripe configuration keys:

- `STRIPE_SECRET_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Do not commit these values. In the managed Webdev environment, configure them through the project integration/configuration flow. Before charging real customers, claim the connected Stripe sandbox/live account and verify the webhook endpoint in Stripe.

## Getting started locally

### Prerequisites

- Node.js 22 or compatible modern Node.js runtime
- pnpm 10.18.0 or compatible pnpm 10 release
- MySQL database accessible through `DATABASE_URL`
- Platform authentication/runtime variables when running outside the managed environment
- Stripe variables if testing checkout or webhook handling

### Install

```bash
pnpm install
```

### Environment

Create a local environment file or load the environment through the platform runtime. At minimum, the database connection is required for application data:

```bash
DATABASE_URL=mysql://user:password@host:3306/opsignal
```

For billing tests, also provide the Stripe variables listed above. Keep server-only secrets out of browser-exposed variables; only values intentionally prefixed for the frontend should be exposed to Vite.

### Database

Apply checked-in migrations:

```bash
pnpm db:migrate
```

Generate a new migration and apply it during schema development:

```bash
pnpm db:push
```

The current billing migration is `drizzle/0002_careless_sentinel.sql`.

### Development server

```bash
pnpm dev
```

The server listens on `PORT` or port `3000` and binds to `0.0.0.0`.

Useful endpoints:

- `GET /api/health` — unauthenticated health response
- `GET /manus-routes.json` — managed route manifest
- `GET /api/platform/config.js` — public runtime configuration script
- `POST /api/stripe/webhook` — signed Stripe webhook receiver
- `/api/trpc/*` — typed application API

## Quality checks

Run the complete local validation suite:

```bash
pnpm check
pnpm build
pnpm test
```

Available scripts:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server with `tsx watch` |
| `pnpm build` | Build the Vite frontend and bundled production server |
| `pnpm start` | Serve the production bundle |
| `pnpm check` | Run TypeScript with no emit |
| `pnpm test` | Run Vitest tests once |
| `pnpm format` | Format the repository with Prettier |
| `pnpm db:migrate` | Apply checked-in Drizzle migrations |
| `pnpm db:push` | Generate and apply a new Drizzle migration |
| `pnpm dev:static` | Run the frontend-only static development server |
| `pnpm build:static` | Build the frontend-only static artifact |

The current automated test coverage includes platform integration and authentication logout behavior. The production build has been validated with the billing and settings implementation.

## Deployment

Opsignal is configured for a managed server deployment:

- **Server:** enabled
- **Database:** enabled
- **Runtime port:** `3000`
- **Health path:** `/api/health`
- **Git canonical branch:** `main`

The production build creates:

- `dist/public/` — Vite frontend assets
- `dist/index.js` — bundled Express/tRPC server

A production process should run:

```bash
pnpm start
```

The process must honor the injected `PORT` value and expose an unauthenticated 2xx health response at `/api/health`.

## Security notes

- Server-only Stripe credentials are never sent to the browser.
- Stripe webhooks use raw-body HMAC verification and constant-time comparison.
- Stripe event IDs are persisted to prevent duplicate processing.
- Protected tRPC procedures derive workspace ownership from the authenticated user context.
- Application mutations write audit events for traceability.
- The app does not claim an integration is connected when it only exists in setup/attention state.
- The webhook route is registered before the general JSON body parser so signature verification receives the original request bytes.
- Do not log payment secrets, session cookies, database URLs, or full webhook payloads in production logs.

## Current limitations

Opsignal is production-oriented, but several product capabilities are intentionally staged for the next release:

1. **Provider sync execution:** the integration inventory and setup state are real, but provider-specific OAuth/API sync workers still need to be connected for each source.
2. **Entitlement enforcement:** subscription state is persisted and visible; plan limits currently function as product guidance/UI context rather than complete server-side quota enforcement.
3. **Billing lifecycle controls:** checkout and verified subscription activation are implemented; customer self-service cancellation, invoice retrieval, refunds, and failed-payment recovery should be added before broad commercial launch.
4. **Invitation delivery:** team invitations are persisted as team members; an email delivery workflow is still needed for sending invitation links.
5. **Automated webhook coverage:** the webhook has been smoke-tested with a signed callback; dedicated fixture tests for every supported Stripe event type should be added before live billing rollout.
6. **Multi-workspace membership:** the current ownership model centers on a workspace owner; a richer membership/role model is a natural next step for Team plan governance.

## Recommended next steps

### Before live customer launch

- Claim and configure the live Stripe account.
- Confirm live webhook delivery and replay behavior.
- Add fixture tests for checkout completion, subscription updates, cancellation, and past-due events.
- Add server-side plan-limit enforcement.
- Connect the first production provider sync, ideally one high-value source with reliable OAuth/webhook support.
- Add transactional invitation email delivery.
- Add database backups, error monitoring, and operational alerting.

### Product expansion

- Source adapters for Calendly, Amplitude, Stripe, Apollo, and other connected systems.
- Rule-based signal normalization and deduplication.
- AI-assisted signal summaries and recommended next actions.
- Playbook execution and action creation from incoming signals.
- Role-based access controls and multi-workspace memberships.
- Customer billing portal and invoice history.
- Public integration health and sync-latency metrics.

## License

This project is licensed under the MIT License as declared in `package.json`.
