CREATE TABLE "product_rent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"rented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sell_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_rent_records" ADD CONSTRAINT "product_rent_records_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_rent_records" ADD CONSTRAINT "product_rent_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sell_records" ADD CONSTRAINT "product_sell_records_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sell_records" ADD CONSTRAINT "product_sell_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rent_record_transaction_idx" ON "product_rent_records" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "rent_record_product_idx" ON "product_rent_records" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "rent_record_status_idx" ON "product_rent_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rent_record_rented_at_idx" ON "product_rent_records" USING btree ("rented_at");--> statement-breakpoint
CREATE INDEX "sell_record_transaction_idx" ON "product_sell_records" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "sell_record_product_idx" ON "product_sell_records" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sell_record_status_idx" ON "product_sell_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sell_record_sold_at_idx" ON "product_sell_records" USING btree ("sold_at");