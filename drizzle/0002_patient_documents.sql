CREATE TABLE `patient_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`patient_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`asa_class` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
