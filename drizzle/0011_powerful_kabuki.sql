CREATE TABLE "floorplan_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"analyzed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "floorplan_analyses" ADD CONSTRAINT "floorplan_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplan_analyses" ADD CONSTRAINT "floorplan_analyses_analyzed_by_users_id_fk" FOREIGN KEY ("analyzed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_floorplan_analyses_project_id" ON "floorplan_analyses" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_floorplan_analyses_unique_project" ON "floorplan_analyses" USING btree ("project_id");