CREATE TABLE `actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`signalId` int,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`ownerName` varchar(120) NOT NULL,
	`ownerEmail` varchar(320),
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','done','dismissed') NOT NULL DEFAULT 'open',
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`actorName` varchar(120) NOT NULL,
	`action` varchar(160) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`context` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`category` varchar(80) NOT NULL,
	`status` enum('connected','attention','available') NOT NULL DEFAULT 'available',
	`description` text NOT NULL,
	`lastSyncAt` timestamp,
	`recordsSynced` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playbooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`trigger` text NOT NULL,
	`ownerName` varchar(120) NOT NULL,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`nextStep` text NOT NULL,
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playbooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`title` text NOT NULL,
	`source` varchar(80) NOT NULL,
	`sourceType` varchar(80) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('new','triaged','closed') NOT NULL DEFAULT 'new',
	`summary` text NOT NULL,
	`impact` text NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teamMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(320),
	`role` varchar(120) NOT NULL,
	`scope` varchar(160) NOT NULL,
	`avatarColor` varchar(20) NOT NULL DEFAULT '#a9e8d5',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teamMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`timezone` varchar(80) NOT NULL DEFAULT 'America/Denver',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_slug_unique` UNIQUE(`slug`)
);
