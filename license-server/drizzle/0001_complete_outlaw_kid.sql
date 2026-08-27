ALTER TABLE "activations" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activations" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "activations" ADD COLUMN "ip_first" text;--> statement-breakpoint
ALTER TABLE "activations" ADD COLUMN "ip_last" text;--> statement-breakpoint
ALTER TABLE "activations" ADD COLUMN "reactivations" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "max_activations" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "activation_locked" boolean DEFAULT false NOT NULL;