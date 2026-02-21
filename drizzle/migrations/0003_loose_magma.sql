CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2),
	"stock" integer,
	"sku" text,
	"image_key" text,
	"image_url" text,
	"menu_category_id" uuid NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menus_slug_unique" UNIQUE("slug"),
	CONSTRAINT "menus_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_menu_category_id_menu_categories_id_fk" FOREIGN KEY ("menu_category_id") REFERENCES "public"."menu_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_name_idx" ON "menus" USING btree ("name");--> statement-breakpoint
CREATE INDEX "menu_slug_idx" ON "menus" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "menu_category_idx" ON "menus" USING btree ("menu_category_id");--> statement-breakpoint
CREATE INDEX "menu_available_idx" ON "menus" USING btree ("is_available");