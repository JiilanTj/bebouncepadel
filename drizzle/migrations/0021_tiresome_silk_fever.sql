CREATE TABLE "sync_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb,
	"triggered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_histories" ADD CONSTRAINT "sync_histories_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_histories_type_idx" ON "sync_histories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sync_histories_status_idx" ON "sync_histories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_histories_created_at_idx" ON "sync_histories" USING btree ("created_at");