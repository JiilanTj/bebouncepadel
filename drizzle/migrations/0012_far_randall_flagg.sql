CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ayo_field_id" text,
	"name" text NOT NULL,
	"slug" text,
	"type" text NOT NULL,
	"surface" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"price_per_hour" numeric(10, 2) NOT NULL,
	"image_key" text,
	"image_url" text,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "slug" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "icon" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "updated_at" SET NOT NULL;