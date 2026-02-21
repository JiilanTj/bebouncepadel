ALTER TABLE "order_requests" ADD COLUMN "transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_request_transaction_idx" ON "order_requests" USING btree ("transaction_id");--> statement-breakpoint

-- Update order_requests status enum to include PREPARING and SERVED
ALTER TABLE "order_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_requests" ALTER COLUMN "status" TYPE text;--> statement-breakpoint
DROP TYPE IF EXISTS "order_requests_status_enum";--> statement-breakpoint
CREATE TYPE "order_requests_status_enum" AS ENUM ('PENDING', 'APPROVED', 'PREPARING', 'SERVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "order_requests" ALTER COLUMN "status" TYPE "order_requests_status_enum" USING status::"order_requests_status_enum";--> statement-breakpoint
ALTER TABLE "order_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
