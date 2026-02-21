CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_phone" text,
	"business_address" text,
	"business_map_link" text,
	"facebook_url" text,
	"instagram_url" text,
	"tiktok_url" text,
	"twitter_url" text,
	"hero_image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
