# Security Review - OAuth Implementation (2026-02-03)

Scope: current OAuth server implementation in this workspace.

Files reviewed:
- `src/routes/api/oauth/authorize/+server.ts`
- `src/routes/api/oauth/token/+server.ts`
- `src/lib/server/oauth.ts`
- `src/lib/server/schema.ts`

## Findings

1) Critical - Redirect URI is not bound to the client registration
Risk: Any HTTPS redirect URI is accepted, so a malicious client can supply an attacker-controlled `redirect_uri` and receive valid authorization codes. This breaks the core OAuth authorization guarantee.
Location: `src/routes/api/oauth/authorize/+server.ts:14-83`, `src/lib/server/schema.ts:151-166`
Recommendation: Store allowed redirect URIs per client and require an exact match (string equality) against the registered list. Reject requests that do not match. Consider migrating existing clients with explicit redirect URIs before enabling the endpoint in production.

2) High - PKCE "plain" is allowed, weakening code interception defenses
Risk: Allowing `plain` permits weaker PKCE. If an authorization code is leaked (logs/DB), the attacker can redeem it without needing the original verifier. This is especially risky while codes are stored in plaintext.
Location: `src/routes/api/oauth/authorize/+server.ts:65-67`, `src/lib/server/oauth.ts:74-85`, `src/lib/server/schema.ts:214-235`
Recommendation: Require `S256` only. Remove `plain` support from validation and from the DB check constraint.

3) Medium - Authorization codes are stored in plaintext
Risk: A DB leak exposes active authorization codes. With `plain` allowed, that becomes a direct account access risk; even with `S256`, plaintext codes can be replayed if the verifier leaks elsewhere.
Location: `src/lib/server/oauth.ts:257-283`, `src/lib/server/schema.ts:214-235`
Recommendation: Store a hash of the authorization code (e.g., SHA-256) and look up by hash during exchange. Never persist the plaintext code.

4) Medium - Access token validation is O(n) with bcrypt per request
Risk: `validateAccessToken` loads all non-expired tokens and compares each with bcrypt. This is expensive and becomes a CPU DoS vector as token count grows.
Location: `src/lib/server/oauth.ts:383-401`
Recommendation: Store a fast hash (SHA-256 or HMAC) of the access token and query by hash with an index for O(1) lookup. Use constant-time compare on the single record.

5) Low - No rate limiting on token endpoint
Risk: The token endpoint can be brute-forced (client secret guessing) or abused for resource exhaustion.
Location: `src/routes/api/oauth/token/+server.ts:24-116`
Recommendation: Add per-IP and per-client rate limiting, plus logging for repeated failures.

6) Low - PKCE parameter format/length not enforced
Risk: Non-compliant `code_verifier` and `code_challenge` values may be accepted. This weakens enforcement and complicates debugging.
Location: `src/routes/api/oauth/authorize/+server.ts:56-70`, `src/lib/server/oauth.ts:74-85`
Recommendation: Enforce RFC 7636 length (43-128) and base64url character set for `S256`.

## Notes / Open Items

- The consent UI/handler is not present yet (`/oauth/consent`). When implemented, ensure it re-validates `client_id`, `redirect_uri`, and PKCE parameters server-side and does not trust query parameters alone.

## Positive Observations

- Client secrets and access tokens are not stored in plaintext (hashed at rest).
- Authorization codes are one-time use and have short lifetimes.
