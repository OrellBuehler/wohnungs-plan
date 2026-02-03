ALTER TABLE "oauth_authorization_codes" ADD COLUMN "used_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_oauth_authorizations_user_client" ON "oauth_authorizations" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_tokens_access_token_hash" ON "oauth_tokens" USING btree ("access_token_hash");