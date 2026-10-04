CREATE TABLE `billingHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`kind` varchar(80) NOT NULL,
	`plan` enum('free','pro','team') NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('pending','paid','failed','canceled') NOT NULL DEFAULT 'pending',
	`stripeCheckoutSessionId` varchar(120),
	`stripeInvoiceId` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(160) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`workspaceId` int,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`plan` enum('free','pro','team') NOT NULL DEFAULT 'free',
	`status` enum('active','trialing','past_due','canceled') NOT NULL DEFAULT 'active',
	`stripeCustomerId` varchar(120),
	`stripeSubscriptionId` varchar(120),
	`currentPeriodEnd` timestamp,
	`cancelAtPeriodEnd` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_workspaceId_unique` UNIQUE(`workspaceId`)
);
