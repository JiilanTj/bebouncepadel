CREATE TABLE "order_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_request_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"table_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_requests_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "order_request_items" ADD CONSTRAINT "order_request_items_order_request_id_order_requests_id_fk" FOREIGN KEY ("order_request_id") REFERENCES "public"."order_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_request_items" ADD CONSTRAINT "order_request_items_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_request_item_order_idx" ON "order_request_items" USING btree ("order_request_id");--> statement-breakpoint
CREATE INDEX "order_request_item_menu_idx" ON "order_request_items" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "order_request_number_idx" ON "order_requests" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "order_request_table_idx" ON "order_requests" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "order_request_status_idx" ON "order_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_request_created_at_idx" ON "order_requests" USING btree ("created_at");