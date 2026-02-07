CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"forked_from_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "item_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "item_changes_action_check" CHECK (action IN ('create', 'update', 'delete'))
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_forked_from_id_branches_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_changes" ADD CONSTRAINT "item_changes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_changes" ADD CONSTRAINT "item_changes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_changes" ADD CONSTRAINT "item_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_branches_project_id" ON "branches" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_branches_created_at" ON "branches" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_branches_project_name" ON "branches" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "idx_item_changes_project_id" ON "item_changes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_item_changes_branch_id" ON "item_changes" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_item_changes_item_id" ON "item_changes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_changes_created_at" ON "item_changes" USING btree ("created_at");--> statement-breakpoint
-- Add branch_id as nullable first
ALTER TABLE "items" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
-- Create a Main branch for each project that has items
INSERT INTO "branches" ("project_id", "name", "created_by")
SELECT DISTINCT i."project_id", 'Main', p."owner_id"
FROM "items" i
JOIN "projects" p ON p."id" = i."project_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Backfill items with their project's Main branch
UPDATE "items" SET "branch_id" = b."id"
FROM "branches" b
WHERE b."project_id" = "items"."project_id" AND b."name" = 'Main';--> statement-breakpoint
-- Now make it NOT NULL
ALTER TABLE "items" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_items_branch_id" ON "items" USING btree ("branch_id");