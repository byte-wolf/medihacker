ALTER TABLE `patient_documents` ADD `form_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `patient_documents_form_id_unique` ON `patient_documents` (`form_id`);