# External Integrations

**Analysis Date:** 2026-02-17

## APIs & External Services

**OIDC/OAuth:**

- Infomaniak OIDC Provider - User authentication and identity
  - SDK/Client: Manual OAuth 2.0 with PKCE (S256 only)
  - Implementation: `src/lib/server/oauth.ts`, `src/lib/server/oidc.ts`
  - Endpoints: Authorization (`https://login.infomaniak.com/authorize`), Token (`https://login.infomaniak.com/token`), UserInfo (`https://login.infomaniak.com/oauth2/userinfo`)
  - Auth: Environment variables `INFOMANIAK_CLIENT_ID`, `INFOMANIAK_CLIENT_SECRET`, `INFOMANIAK_REDIRECT_URI`
  - Redirect URI: `/api/auth/callback` (configurable)

**Model Context Protocol (MCP):**

- MCP Server - Exposes project, item, and analysis tools to Claude AI agents
  - SDK: `@modelcontextprotocol/sdk` 1.25.3
  - Endpoint: `/api/mcp` (POST for JSON-RPC 2.0 requests)
  - Well-known endpoints: `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, `/.well-known/oauth-protected-resource/api/mcp`
  - Authentication: Bearer token (OAuth access token with `mcp:access` scope)
  - Session management: HTTP-based transport with `mcp-session-id` header
  - Implementation: `src/routes/api/mcp/+server.ts`

**AI Analysis (Planned):**

- Anthropic Claude API - Used by external Claude clients to analyze floorplans
  - SDK: `@anthropic-ai/sdk` 0.74.0 (imported but not directly used by backend)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Usage: External Claude instances call Claude's vision to analyze floorplan images, then use MCP tools to save analysis results
  - No direct backend-to-Claude calls; integration happens via MCP interface to external AI agents

## Data Storage

**Databases:**

- PostgreSQL (primary)
  - Connection: `DATABASE_URL` environment variable
  - Client: Bun SQL driver (native, faster than node-postgres)
  - ORM: Drizzle ORM 0.45.1
  - Schema: `src/lib/server/schema.ts`
  - Tables: users, sessions, projects, branches, floorplans, items, item_images, comments, replies, share_links, oauth clients/tokens/authorizations/codes, floorplan_analyses, history_entries, members
  - Migrations: Stored in `drizzle/` directory, auto-run on dev startup

**File Storage:**

- Local filesystem
  - Floorplans: `UPLOAD_DIR/floorplans/` (default `./uploads/floorplans/`)
  - Item images: `UPLOAD_DIR/items/` (default `./uploads/items/`)
  - Thumbnails: `UPLOAD_DIR/thumbnails/` (cached project previews)
  - Server-side image processing with sharp 0.34.5

**Client-side Storage:**

- IndexedDB (via idb 8.0.3)
  - Purpose: Offline support for local projects (not implemented in current version)
  - Implementation: `src/lib/stores/project.svelte.ts`, `src/lib/stores/sync.svelte.ts`
  - Sync queue: Pending changes tracked in memory (could be persisted to IndexedDB)

**Caching:**

- Service Worker (Workbox)
  - Cache-first: App shell (HTML, CSS, JS, fonts, icons)
  - Cache-first: Images with 30-day expiration
  - Network-first: API routes
  - Configuration: `src/service-worker.ts`, `@vite-pwa/sveltekit` plugin

## Authentication & Identity

**Auth Provider:**

- Infomaniak OIDC (custom implementation, not third-party library)
  - Implementation files: `src/lib/server/oauth.ts`, `src/lib/server/session.ts`, `src/routes/oauth/`
  - Approach:
    - Manual OAuth 2.0 flow with PKCE (S256 only, no plain)
    - Authorization code exchanged for access/refresh tokens
    - Sessions stored in PostgreSQL with `SESSION_SECRET` hashing
    - Refresh token rotation: 30-day lifetime
    - Access token lifetime: 1 hour
    - Session cookies: HTTP-only, secure, SameSite=Lax

**Session Management:**

- Custom JWT-like tokens (base64url-encoded random bytes with bcrypt hashing)
- Token storage: PostgreSQL `sessions`, `oauthTokens`, `oauthAuthorizationCodes` tables
- Cookie: `session_id` (HTTP-only, parsed in `src/hooks.server.ts`)

**OAuth Server (Backend):**

- Self-hosted OAuth provider for MCP clients
  - Endpoints: `/api/oauth/authorize`, `/api/oauth/token`
  - Route aliases: `/authorize` → redirect, `/token` → proxy
  - Error page: `/oauth/error?code=...&detail=...`
  - Client management: OAuth clients registered in database with hashed secrets
  - Authorization endpoint: `/api/oauth/authorize` (prompts for consent)
  - Token endpoint: `/api/oauth/token` (issues access/refresh tokens)
  - Supports PKCE-based clients (e.g., MCP clients)

**CSRF Protection:**

- SvelteKit built-in CSRF disabled (`csrf.trustedOrigins: ['*']`) to allow cross-origin OAuth token exchange
- Manual origin checking in `src/hooks.server.ts` for non-exempt routes
- OAuth/MCP endpoints exempt (use PKCE/Bearer tokens instead of cookies)

## Monitoring & Observability

**Error Tracking:**

- Not detected - Error handling via try/catch and error responses

**Logs:**

- Console logging (Node.js console)
- Database migration logs in `src/lib/server/db.ts`
- MCP server logs in `src/routes/api/mcp/+server.ts`
- Docker health check: `wget` to `/api/auth/me` endpoint

**Build Versioning:**

- Git hash and build timestamp embedded in HTML comment during Docker build
- Environment variables: `VITE_GIT_HASH`, `VITE_BUILD_TIMESTAMP`
- View in browser: View Source → `<head>` → `<!-- version: abc1234 | built: 2026-02-03T10:30:00Z -->`
- File: `/app/version.txt` (in container)

## CI/CD & Deployment

**Hosting:**

- Docker containers (multi-stage build)
- Port: 3000
- Base image: `oven/bun:1-alpine`
- Health check: Polling `/api/auth/me` every 30 seconds
- Non-root user: `sveltekit` (UID 1001)

**Build Process:**

- Stage 1 (deps): Install dependencies with bun.lock
- Stage 2 (builder): Build SvelteKit app with Vite
- Stage 3 (prod-deps): Install only production dependencies
- Stage 4 (runner): Copy build artifacts and run production server
- Build arguments: `GIT_HASH`, `BUILD_TIMESTAMP` for version tracking
- Environment variable `LD_LIBRARY_PATH` set for sharp's native libvips

**CI Pipeline:**

- Not detected - No GitHub Actions or CI config found

## Environment Configuration

**Required env vars:**

- `INFOMANIAK_CLIENT_ID` - OAuth client ID from Infomaniak
- `INFOMANIAK_CLIENT_SECRET` - OAuth client secret
- `INFOMANIAK_REDIRECT_URI` - OAuth redirect (default: `http://localhost:5173/api/auth/callback`)
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgres://user:pass@localhost:5432/floorplanner`)
- `SESSION_SECRET` - 32-byte random string for session hashing (generated via `openssl rand -base64 32`)
- `ANTHROPIC_API_KEY` - Anthropic API key (optional, for future Claude integrations)
- `UPLOAD_DIR` - Directory for file uploads (default: `./uploads`)
- `MAX_IMAGE_SIZE_BYTES` - Max image size (default: `5242880` = 5MB)
- `PUBLIC_APP_URL` - Frontend URL for links (default: `http://localhost:5173`)
- `PUBLIC_URL` - Public URL for OAuth redirects (optional, defaults to request origin)

**Secrets location:**

- `.env` file in project root (never committed)
- Docker: Passed as environment variables to container
- Development: `.env.example` provides template

## Webhooks & Callbacks

**Incoming:**

- OAuth redirect: `/api/auth/callback` (receives `code` and `state` parameters)
- Consent POST: `/oauth/consent` (form submission for OAuth user authorization)

**Outgoing:**

- Floorplan analysis via MCP: External Claude clients call save_floorplan_analysis tool with analysis results
- No outgoing webhooks detected

## Rate Limiting

**Implemented:**

- Image downloads: Max 5 images per 15 minutes per user
- Rate limit check: `src/lib/server/rate-limit.ts`
- Tracks: User ID and action type in-memory (not persisted to database)

## File Upload Handling

**Endpoints:**

- Floorplans: POST `/api/projects/[id]/floorplan` (accepts image files)
- Item images: POST `/api/projects/[id]/branches/[branchId]/items/[itemId]/images` (accepts image files)
- External images: GET via MCP tool `add_item_image_from_url` (downloads from HTTPS URLs only)

**Security:**

- Max size: `MAX_IMAGE_SIZE_BYTES` (5MB default, 10MB via `BODY_SIZE_LIMIT` in Docker)
- Allowed formats: JPEG, PNG, WebP (validated via MIME type)
- External downloads: HTTPS only, no private IPs (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, ::1)
- Server-side processing: Thumbnails generated with sharp
- Stored in: `UPLOAD_DIR/floorplans/` and `UPLOAD_DIR/items/`

---

_Integration audit: 2026-02-17_
