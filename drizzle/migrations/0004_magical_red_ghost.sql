CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'EMPTY' NOT NULL,
	"capacity" integer,
	"location" text,
	"current_customer_name" text,
	"current_customer_phone" text,
	"occupied_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tables_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "table_code_idx" ON "tables" USING btree ("code");--> statement-breakpoint
CREATE INDEX "table_status_idx" ON "tables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "table_location_idx" ON "tables" USING btree ("location");