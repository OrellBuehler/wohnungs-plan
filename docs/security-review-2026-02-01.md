# Security Review (2026-02-01)

Scope: staged changes in the working tree at review time.

## Findings

1) High - Path traversal via upload filename extension
- Risk: `ext` is derived from `file.name`, allowing path separators (e.g. `png/../../...`) that can escape the upload directory when joined.
- Location: `src/routes/api/projects/[id]/floorplan/+server.ts:34`, `src/lib/server/floorplans.ts:76`
- Recommendation: Derive extension from a hard-mapped MIME whitelist or sanitize to `[a-z0-9]+` before building the filename.

2) Medium - Private floorplan images cached as public
- Risk: `Cache-Control: public, max-age=31536000, immutable` without `Vary: Cookie` can leak authenticated images via shared caches.
- Location: `src/routes/api/images/floorplans/[projectId]/[filename]/+server.ts:44`
- Recommendation: Use `private` or `no-store` for authenticated media, or add `Vary: Cookie` if you must cache.

3) Medium - Cookie security flags not guaranteed in production
- Risk: `oauth_state` never sets `Secure`. Session cookie `Secure` flag is tied to the OIDC redirect URI rather than the actual request/app URL.
- Location: `src/routes/api/auth/login/+server.ts:8`, `src/lib/server/session.ts:97`
- Recommendation: Set `secure: true` in production based on `event.url.protocol === 'https:'` or a trusted env flag (e.g., `NODE_ENV`, `PUBLIC_APP_URL`), and ensure `clearSessionCookie` mirrors the flags used.

4) Medium - File type validation relies on client-supplied MIME
- Risk: `file.type` can be spoofed, allowing non-images to be stored and served.
- Location: `src/routes/api/projects/[id]/floorplan/+server.ts:26`
- Recommendation: Verify content via magic bytes or decode with a trusted image library before persisting.

5) Low - WebSocket update messages lack role enforcement
- Risk: Viewers can send `item_*` messages that get rebroadcast, potentially misleading other clients.
- Location: `src/lib/server/ws-handler.ts:118`
- Recommendation: Enforce role checks or accept only server-originated updates for authoritative changes.

## Assumptions
- Images are meant to be private; if you have cache keying on cookies already, the caching risk is reduced but still worth verifying.
