ALTER TABLE "licenses" ADD COLUMN "suspected_abuse" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "suspected_abuse_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "suspected_abuse_note" text;