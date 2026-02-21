CREATE TABLE "inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" text,
	"condition" text DEFAULT 'GOOD' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"owner_name" text,
	"purchase_date" timestamp with time zone,
	"purchase_price" numeric(10, 2),
	"image_key" text,
	"image_url" text,
	"location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"change_amount" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_name_idx" ON "inventories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "inventory_slug_idx" ON "inventories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "inventory_type_idx" ON "inventories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "inventory_condition_idx" ON "inventories" USING btree ("condition");--> statement-breakpoint
CREATE INDEX "inventory_status_idx" ON "inventories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "adjustment_inventory_idx" ON "inventory_adjustments" USING btree ("inventory_id");--> statement-breakpoint
CREATE INDEX "adjustment_created_at_idx" ON "inventory_adjustments" USING btree ("created_at");