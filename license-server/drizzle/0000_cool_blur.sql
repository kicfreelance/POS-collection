CREATE TABLE "activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"license_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"hostname" text,
	"role" text DEFAULT 'standalone' NOT NULL,
	"app_version" text,
	"os" text,
	"token_version" integer DEFAULT 1 NOT NULL,
	"active_terminals" integer DEFAULT 0 NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"license_id" uuid,
	"type" text NOT NULL,
	"fingerprint" text,
	"ip" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"product" text NOT NULL,
	"edition" text DEFAULT 'standard' NOT NULL,
	"seat_limit" integer DEFAULT 1 NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"bound_fingerprint" text,
	"bound_at" timestamp with time zone,
	"activation_count" integer DEFAULT 0 NOT NULL,
	"max_transfers" integer DEFAULT 3 NOT NULL,
	"transfers_used" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "terminal_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"license_id" uuid NOT NULL,
	"activation_id" uuid NOT NULL,
	"machine_id" text NOT NULL,
	"hostname" text,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_registrations" ADD CONSTRAINT "terminal_registrations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_registrations" ADD CONSTRAINT "terminal_registrations_activation_id_activations_id_fk" FOREIGN KEY ("activation_id") REFERENCES "public"."activations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activations_license_fingerprint_uq" ON "activations" USING btree ("license_id","fingerprint");--> statement-breakpoint
CREATE INDEX "activations_license_idx" ON "activations" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "events_license_idx" ON "events" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "terminal_reg_activation_machine_uq" ON "terminal_registrations" USING btree ("activation_id","machine_id");--> statement-breakpoint
CREATE INDEX "terminal_reg_license_idx" ON "terminal_registrations" USING btree ("license_id");