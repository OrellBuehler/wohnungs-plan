ALTER TABLE "oauth_tokens" ADD COLUMN "refresh_token_hash" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;