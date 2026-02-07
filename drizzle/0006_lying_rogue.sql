ALTER TABLE "oauth_clients" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "client_name" text;