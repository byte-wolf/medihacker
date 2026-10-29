CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`patient_id` text,
	`action` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contradictions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`title` text NOT NULL,
	`explanation` text NOT NULL,
	`severity` text NOT NULL,
	`categories` text NOT NULL,
	`passage_ids` text NOT NULL,
	`detected_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`patient_id` text NOT NULL,
	`situation_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`situation_id`) REFERENCES `situations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `llm_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_hash` text NOT NULL,
	`response` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_cache_prompt_hash_unique` ON `llm_cache` (`prompt_hash`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`latency_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `passage_translations` (
	`passage_id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`doc_hash` text NOT NULL,
	`translation` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `patient_index` (
	`patient_id` text PRIMARY KEY NOT NULL,
	`doc_hash` text NOT NULL,
	`prompt_version` text NOT NULL,
	`contradiction_mode` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `situations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`role` text,
	`is_preset` integer DEFAULT false NOT NULL,
	`created_by_user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_situations` (
	`user_id` integer NOT NULL,
	`situation_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `situation_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`situation_id`) REFERENCES `situations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`department` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);