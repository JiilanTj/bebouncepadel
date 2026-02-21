ALTER TABLE "product_rent_records" ADD COLUMN "expected_return_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_rent_records" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "deposit_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fine_amount" numeric(10, 2) DEFAULT '0' NOT NULL;